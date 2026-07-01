# Inference engine for menu recommendations
# app/inference_engine.py

from datetime import datetime, timezone, date
from typing import Dict, List, Tuple, Optional
from sqlalchemy.orm import Session

from app.models import (
    Patient,
    PatientHealthProfile,
    MenuOption,
    Recommendation,
    RecommendationItem,
    ApprovalHistory,
)

from app.rules import (
    calculate_bmi,
    get_bmi_category,
    get_age_category,
    get_calorie_factor,
    calculate_daily_calories,
    calculate_meal_targets,
    get_cycle_day_from_date,  # <-- NEW: accepts full date
    build_constraints,
    passes_constraints,
    score_menu,
)

from app.explanation import build_explanation


def generate_recommendation(
    db: Session,
    patient_id,
    menu_date: Optional[str] = None,  # <-- CHANGED: accepts "2026-06-24" from calendar
):
    """
    Main Forward Chaining Engine with proper Rule Trace (R001, R042, etc.)

    Args:
        menu_date: ISO date string from calendar picker (e.g., "2026-06-24")
                   If None, uses today's date.
    """

    # ======================================================
    # Load Patient
    # ======================================================

    patient = (
        db.query(Patient)
        .filter(Patient.id == patient_id)
        .first()
    )

    if not patient:
        raise ValueError("Patient not found")

    profile = (
        db.query(PatientHealthProfile)
        .filter(PatientHealthProfile.patient_id == patient.id)
        .first()
    )

    if not profile:
        raise ValueError("Patient health profile not found")

    # ======================================================
    # Forward Chaining — Generate Facts with Rule IDs
    # ======================================================

    rule_trace = []
    rejected_menus = []

    # R1: BMI calculation
    bmi = calculate_bmi(profile.weight_kg, profile.height_cm)
    rule_trace.append({
        "rule_id": "R1",
        "condition_matched": f"Weight={profile.weight_kg}kg, Height={profile.height_cm}cm",
        "conclusion": f"BMI = {bmi}",
        "message": f"BMI calculated as {bmi} using weight and height"
    })

    # R2-R4: BMI category
    bmi_category = get_bmi_category(bmi)
    bmi_rule = "R2" if bmi_category == "underweight" else "R3" if bmi_category == "normal" else "R4"
    rule_trace.append({
        "rule_id": bmi_rule,
        "condition_matched": f"BMI = {bmi}",
        "conclusion": f"BMI category = {bmi_category}",
        "message": f"Patient BMI {bmi} falls into {bmi_category} category"
    })

    # R5-R7: Age category
    age_category = get_age_category(patient.age)
    age_rule = "R5" if age_category == "child" else "R6" if age_category == "teenager" else "R7"
    rule_trace.append({
        "rule_id": age_rule,
        "condition_matched": f"Age = {patient.age}",
        "conclusion": f"Age category = {age_category}",
        "message": f"Patient age {patient.age} classified as {age_category}"
    })

    # R8-R16: Calorie factor
    calorie_factor = get_calorie_factor(bmi_category, profile.activity_level)
    cf_key = (bmi_category.lower(), profile.activity_level.lower())
    cf_rules = {
        ("overweight", "sedentary"): "R8",
        ("overweight", "moderate"): "R9",
        ("overweight", "active"): "R10",
        ("normal", "sedentary"): "R11",
        ("normal", "moderate"): "R12",
        ("normal", "active"): "R13",
        ("underweight", "sedentary"): "R14",
        ("underweight", "moderate"): "R15",
        ("underweight", "active"): "R16",
    }
    cf_rule = cf_rules.get(cf_key, "R8")
    rule_trace.append({
        "rule_id": cf_rule,
        "condition_matched": f"BMI={bmi_category}, Activity={profile.activity_level}",
        "conclusion": f"Calorie factor = {calorie_factor}",
        "message": f"Based on {bmi_category} BMI and {profile.activity_level} activity, calorie factor is {calorie_factor}"
    })

    # R17: Base daily calories
    base_calories = float(profile.weight_kg) * calorie_factor
    rule_trace.append({
        "rule_id": "R17",
        "condition_matched": f"Weight={profile.weight_kg}kg, Calorie factor={calorie_factor}",
        "conclusion": f"Base daily calories = {base_calories:.0f} kcal",
        "message": f"Base calories: {profile.weight_kg} x {calorie_factor} = {base_calories:.0f} kcal"
    })

    # R18-R20: Age-adjusted calories
    if age_category == "child":
        age_adjusted = base_calories * 0.80
        age_adj_rule = "R18"
    elif age_category == "teenager":
        age_adjusted = base_calories * 0.90
        age_adj_rule = "R19"
    else:
        age_adjusted = base_calories
        age_adj_rule = "R20"
    rule_trace.append({
        "rule_id": age_adj_rule,
        "condition_matched": f"Age category = {age_category}",
        "conclusion": f"Age-adjusted calories = {age_adjusted:.0f} kcal",
        "message": f"{age_category.title()} adjustment applied: {age_adjusted:.0f} kcal"
    })

    # R21-R26: Patient category adjustment
    adjustment = 0
    if profile.patient_category == "normal":
        cat_rule = "R21"
    elif profile.patient_category == "pregnant":
        if profile.pregnancy_trimester == 1:
            adjustment = 300
            cat_rule = "R22"
        elif profile.pregnancy_trimester == 2:
            adjustment = 350
            cat_rule = "R23"
        else:
            adjustment = 500
            cat_rule = "R24"
    elif profile.patient_category == "pre-operation":
        adjustment = -200
        cat_rule = "R25"
    elif profile.patient_category == "post-operation":
        adjustment = 200
        cat_rule = "R26"
    else:
        cat_rule = "R21"

    rule_trace.append({
        "rule_id": cat_rule,
        "condition_matched": f"Patient category = {profile.patient_category}",
        "conclusion": f"Calorie adjustment = {adjustment:+d} kcal",
        "message": f"{profile.patient_category} category adjustment: {adjustment:+d} kcal"
    })

    # R27: Final daily calories
    final_daily_calories = int(round(age_adjusted + adjustment))
    rule_trace.append({
        "rule_id": "R27",
        "condition_matched": f"Age-adjusted={age_adjusted:.0f}, Adjustment={adjustment}",
        "conclusion": f"Final daily calories = {final_daily_calories} kcal",
        "message": f"Final: {age_adjusted:.0f} + {adjustment} = {final_daily_calories} kcal/day"
    })

    # R28-R30: Meal targets
    meal_targets = calculate_meal_targets(final_daily_calories)
    rule_trace.append({
        "rule_id": "R28-R30",
        "condition_matched": f"Final daily calories = {final_daily_calories}",
        "conclusion": f"Breakfast={meal_targets['breakfast']}, Lunch={meal_targets['lunch']}, Dinner={meal_targets['dinner']}",
        "message": f"Meal targets: Breakfast 25% ({meal_targets['breakfast']} kcal), Lunch 40% ({meal_targets['lunch']} kcal), Dinner 35% ({meal_targets['dinner']} kcal)"
    })

    # R31-R34: Medical constraints
    constraints = build_constraints(profile)
    if profile.has_diabetes:
        rule_trace.append({
            "rule_id": "R31",
            "condition_matched": "Patient has diabetes",
            "conclusion": "Sugar constraint active — only low sugar meals",
            "message": "Diabetes detected: high sugar meals will be excluded"
        })
    if profile.has_hypertension:
        rule_trace.append({
            "rule_id": "R32",
            "condition_matched": "Patient has hypertension",
            "conclusion": "Sodium constraint active — only low sodium meals",
            "message": "Hypertension detected: high sodium meals will be excluded"
        })
    if profile.has_high_cholesterol:
        rule_trace.append({
            "rule_id": "R33",
            "condition_matched": "Patient has high cholesterol",
            "conclusion": "Fat constraint active — only low fat meals",
            "message": "High cholesterol detected: high fat meals will be excluded"
        })

    # R35-R40: Allergy constraints
    if profile.allergies:
        for allergy in profile.allergies:
            allergy_rules = {
                "nut": "R35", "dairy": "R36", "egg": "R37",
                "seafood": "R38", "gluten": "R39"
            }
            rule_id = allergy_rules.get(allergy.lower(), "R38")
            rule_trace.append({
                "rule_id": rule_id,
                "condition_matched": f"Patient has {allergy} allergy",
                "conclusion": f"Exclude meals with {allergy}",
                "message": f"{allergy.title()} allergy: menus containing {allergy} will be excluded"
            })

    # R41-R44: Cycle day from FRONTEND DATE (your calendar picker!)
    cycle_day, weekday_name = get_cycle_day_from_date(menu_date)
    day_map = {
        "monday": "R42", "friday": "R42",
        "tuesday": "R43", "saturday": "R43",
        "sunday": "R41", "thursday": "R41",
        "wednesday": "R44"
    }
    day_rule = day_map.get(weekday_name, "R42")

    rule_trace.append({
        "rule_id": day_rule,
        "condition_matched": f"Day = {weekday_name.title()} ({menu_date or 'today'})",
        "conclusion": f"Menu day = {cycle_day}",
        "message": f"{weekday_name.title()} maps to menu cycle day {cycle_day}"
    })

    # R45-R48: Patient category filters
    if profile.is_vegetarian:
        rule_trace.append({
            "rule_id": "R45",
            "condition_matched": "Patient is vegetarian",
            "conclusion": "Vegetarian filter active",
            "message": "Vegetarian preference: only vegetarian meals allowed"
        })
    if profile.has_chewing_problem:
        rule_trace.append({
            "rule_id": "R46",
            "condition_matched": "Patient has chewing problem",
            "conclusion": "Chewing filter active",
            "message": "Chewing difficulty: only soft/chewing-friendly meals allowed"
        })
    if profile.patient_category == "pre-operation":
        rule_trace.append({
            "rule_id": "R47",
            "condition_matched": "Patient is pre-operation",
            "conclusion": "Low fibre filter active",
            "message": "Pre-op: low fibre meals required"
        })

    # ======================================================
    # Candidate Search (R49-R58)
    # ======================================================

    selected_menus = {}
    score_traces = {}
    recommendation_items = []

    meal_types = ["breakfast", "lunch", "dinner"]

    no_suitable_alert = {}

    for meal_time in meal_types:

        menus = (
            db.query(MenuOption)
            .filter(
                MenuOption.cycle_day == cycle_day,
                MenuOption.meal_time == meal_time,
                MenuOption.is_active == True,
            )
            .all()
        )

        candidates = []
        meal_rejected = []

        for menu in menus:

            # R50: Calorie target filter
            if menu.calories_kcal is not None and menu.calories_kcal > meal_targets[meal_time]:
                meal_rejected.append({
                    "menu_name": menu.menu_name,
                    "menu_code": menu.menu_code,
                    "reason": f"Calories {menu.calories_kcal} exceed target {meal_targets[meal_time]} kcal (R50)"
                })
                continue

            # R51-R58: Constraint filters
            passed, reject_reasons = passes_constraints(menu, profile)

            if not passed:
                reason_parts = []
                for r in reject_reasons:
                    if r == "high sugar": reason_parts.append("high sugar (R31)")
                    elif r == "high sodium": reason_parts.append("high sodium (R32)")
                    elif r == "high fat": reason_parts.append("high fat (R33)")
                    elif r == "not vegetarian": reason_parts.append("not vegetarian (R55)")
                    elif r == "not chewing friendly": reason_parts.append("not chewing-friendly (R56)")
                    elif r == "not low fibre": reason_parts.append("not low fibre (R57)")
                    elif r == "not suitable for pregnancy": reason_parts.append("not pregnancy-safe")
                    elif r == "not suitable for pre_operation": reason_parts.append("not pre-op suitable")
                    elif r == "not suitable for post_operation": reason_parts.append("not post-op suitable")
                    elif r == "contains allergy ingredient": 
                        allergies = profile.allergies or []
                        reason_parts.append(f"contains allergen ({', '.join(allergies)})")
                    else:
                        reason_parts.append(r)
                
                meal_rejected.append({
                    "menu_name": menu.menu_name,
                    "menu_code": menu.menu_code,
                    "reason": f"Failed safety filters: {', '.join(reason_parts)}"
                })
                continue

            # R59-R63: Scoring
            score, trace = score_menu(menu, profile)

            candidates.append({
                "menu": menu,
                "score": score,
                "trace": trace,
            })

        # R65: No suitable candidate
        if not candidates:
            selected_menus[meal_time] = None
            score_traces[meal_time] = ["No suitable menu found"]
            no_suitable_alert[meal_time] = {
                "alert": True,
                "reasons": [r["reason"] for r in meal_rejected[:3]],
                "total_rejected": len(meal_rejected)
            }
            rejected_menus.extend(meal_rejected)
            continue

        # R64: Select highest scoring candidate
        best_candidate = max(candidates, key=lambda x: x["score"])
        selected_menus[meal_time] = best_candidate["menu"]
        score_traces[meal_time] = best_candidate["trace"]
        no_suitable_alert[meal_time] = {"alert": False}

        rule_trace.append({
            "rule_id": "R64",
            "condition_matched": f"{len(candidates)} candidates for {meal_time}",
            "conclusion": f"Selected {best_candidate['menu'].menu_name} (score: {best_candidate['score']})",
            "message": f"Highest scoring menu for {meal_time}: {best_candidate['menu'].menu_name} with score {best_candidate['score']}"
        })

        rejected_menus.extend(meal_rejected)

    # R66: Recommendation generated
    if any(ns.get("alert", False) for ns in no_suitable_alert.values()):
        status = "needs_dietitian_action"
        rule_trace.append({
            "rule_id": "R65",
            "condition_matched": "No candidate meal exists after safety filters",
            "conclusion": "Dietitian modification required",
            "message": "No suitable menu found for one or more meals. Dietitian must review manually."
        })
    else:
        status = "pending_review"

    rule_trace.append({
        "rule_id": "R66",
        "condition_matched": "Menu recommendation generated",
        "conclusion": f"Status = {status}",
        "message": f"Recommendation created with status: {status}"
    })

    # ======================================================
    # Save Recommendation
    # ======================================================

    # Prevent duplicate recommendations for the same patient + cycle day
    existing = (
        db.query(Recommendation)
        .filter(Recommendation.patient_id == patient.id, Recommendation.cycle_day == cycle_day)
        .first()
    )
    if existing:
        raise ValueError(f"Recommendation already exists for cycle day {cycle_day}")

    recommendation = Recommendation(
        patient_id=patient.id,
        cycle_day=cycle_day,
        status=status,
        generated_at=datetime.now(timezone.utc),
        rule_trace_json=rule_trace,
        explanation_json=build_explanation(
            patient=patient,
            profile=profile,
            bmi=bmi,
            bmi_category=bmi_category,
            age_category=age_category,
            final_daily_calories=final_daily_calories,
            meal_targets=meal_targets,
            selected_menus=selected_menus,
            score_traces=score_traces,
            constraints=constraints,
            rejected_menus=rejected_menus,
        ),
        no_suitable_alert_json=no_suitable_alert,
    )

    db.add(recommendation)
    db.flush()

    # Save Items
    for meal_time in meal_types:
        menu = selected_menus.get(meal_time)
        item = RecommendationItem(
            recommendation_id=recommendation.id,
            meal_time=meal_time,
            menu_option_id=menu.id if menu else None,
            selection_reason=", ".join(score_traces.get(meal_time, [])),
            is_modified=False,
        )
        db.add(item)

    # Approval History
    history = ApprovalHistory(
        recommendation_id=recommendation.id,
        action="generated",
        note=f"Recommendation generated for {weekday_name.title()} (cycle day {cycle_day})",
    )
    db.add(history)

    db.commit()
    db.refresh(recommendation)

    return recommendation
