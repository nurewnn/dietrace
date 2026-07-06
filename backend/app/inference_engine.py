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
    get_calorie_bounds,
    get_cycle_day_from_date,
    build_constraints,
    passes_constraints,
    score_menu,
)

from app.explanation import build_explanation


def generate_recommendation(
    db: Session,
    patient_id,
    menu_date: Optional[str] = None,
):
    """
    Deterministic Rule-Based Sequential Inference Pipeline.

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
    # Sequential Inference — Generate Facts with Rule IDs
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

    # R2-R5: BMI category
    bmi_category = get_bmi_category(bmi)
    bmi_rule = (
        "R2" if bmi_category == "underweight" else
        "R3" if bmi_category == "normal" else
        "R4" if bmi_category == "overweight" else
        "R5"
    )
    rule_trace.append({
        "rule_id": bmi_rule,
        "condition_matched": f"BMI = {bmi}",
        "conclusion": f"BMI category = {bmi_category}",
        "message": f"Patient BMI {bmi} falls into {bmi_category} category"
    })

    # R6-R8: Age category
    age_category = get_age_category(patient.age)
    age_rule = "R6" if age_category == "child" else "R7" if age_category == "teenager" else "R8"
    rule_trace.append({
        "rule_id": age_rule,
        "condition_matched": f"Age = {patient.age}",
        "conclusion": f"Age category = {age_category}",
        "message": f"Patient age {patient.age} classified as {age_category}"
    })

    # R9: BMR (Mifflin-St Jeor)
    gender_offset = 5 if patient.gender.lower() == "male" else -161
    bmr = (10 * float(profile.weight_kg)) + (6.25 * float(profile.height_cm)) - (5 * patient.age) + gender_offset
    rule_trace.append({
        "rule_id": "R9",
        "condition_matched": f"Weight={profile.weight_kg}kg, Height={profile.height_cm}cm, Age={patient.age}, Gender={patient.gender}",
        "conclusion": f"BMR = {bmr:.0f} kcal",
        "message": f"Basal Metabolic Rate (Mifflin-St Jeor): {bmr:.0f} kcal"
    })

    # R10-R12: Activity multiplier
    activity_multipliers = {"sedentary": 1.2, "moderate": 1.375, "active": 1.55}
    activity_multiplier = activity_multipliers.get(profile.activity_level.lower(), 1.2)
    activity_rule = (
        "R10" if profile.activity_level == "sedentary" else
        "R11" if profile.activity_level == "moderate" else
        "R12"
    )
    activity_adjusted = bmr * activity_multiplier
    rule_trace.append({
        "rule_id": activity_rule,
        "condition_matched": f"Activity level = {profile.activity_level}",
        "conclusion": f"Activity-adjusted calories = {activity_adjusted:.0f} kcal",
        "message": f"{profile.activity_level.title()} activity: {bmr:.0f} × {activity_multiplier} = {activity_adjusted:.0f} kcal"
    })

    # R13-R15: Growth adjustment
    growth_adjustment = 0
    if age_category == "child":
        growth_adjustment = 200
        growth_rule = "R13"
    elif age_category == "teenager":
        growth_adjustment = 100
        growth_rule = "R14"
    else:
        growth_rule = "R15"
    rule_trace.append({
        "rule_id": growth_rule,
        "condition_matched": f"Age category = {age_category}",
        "conclusion": f"Growth adjustment = {growth_adjustment:+d} kcal",
        "message": f"{age_category.title()} growth adjustment: {growth_adjustment:+d} kcal"
    })

    # R16-R21: Patient category adjustment
    adjustment = 0
    if profile.patient_category == "normal":
        cat_rule = "R16"
    elif profile.patient_category == "pregnant":
        if profile.pregnancy_trimester == 1:
            adjustment = 300
            cat_rule = "R17"
        elif profile.pregnancy_trimester == 2:
            adjustment = 350
            cat_rule = "R18"
        else:
            adjustment = 500
            cat_rule = "R19"
    elif profile.patient_category == "pre_operation":
        adjustment = -200
        cat_rule = "R20"
    elif profile.patient_category == "post_operation":
        adjustment = 200
        cat_rule = "R21"
    else:
        cat_rule = "R16"

    rule_trace.append({
        "rule_id": cat_rule,
        "condition_matched": f"Patient category = {profile.patient_category}",
        "conclusion": f"Category adjustment = {adjustment:+d} kcal",
        "message": f"{profile.patient_category} category adjustment: {adjustment:+d} kcal"
    })

    # R22: Final daily calories
    final_daily_calories = int(round(activity_adjusted + growth_adjustment + adjustment))
    rule_trace.append({
        "rule_id": "R22",
        "condition_matched": f"Activity-adjusted={activity_adjusted:.0f}, Growth={growth_adjustment:+d}, Adjustment={adjustment:+d}",
        "conclusion": f"Final daily calories = {final_daily_calories} kcal",
        "message": f"Final: {activity_adjusted:.0f} + {growth_adjustment:+d} + {adjustment:+d} = {final_daily_calories} kcal/day"
    })

    # R23-R25: Meal targets
    meal_targets = {
        "breakfast": int(round(final_daily_calories * 0.25)),
        "lunch": int(round(final_daily_calories * 0.40)),
        "dinner": int(round(final_daily_calories * 0.35)),
    }
    rule_trace.append({
        "rule_id": "R23-R25",
        "condition_matched": f"Final daily calories = {final_daily_calories}",
        "conclusion": f"Breakfast={meal_targets['breakfast']}, Lunch={meal_targets['lunch']}, Dinner={meal_targets['dinner']}",
        "message": f"Meal targets: Breakfast 25% ({meal_targets['breakfast']} kcal), Lunch 40% ({meal_targets['lunch']} kcal), Dinner 35% ({meal_targets['dinner']} kcal)"
    })

    # R26-R28: Medical constraints
    constraints = build_constraints(profile)
    if profile.has_diabetes:
        rule_trace.append({
            "rule_id": "R26",
            "condition_matched": "Patient has diabetes",
            "conclusion": "Sugar constraint active — only low sugar meals",
            "message": "Diabetes detected: high sugar meals will be excluded"
        })
    if profile.has_hypertension:
        rule_trace.append({
            "rule_id": "R27",
            "condition_matched": "Patient has hypertension",
            "conclusion": "Sodium constraint active — only low sodium meals",
            "message": "Hypertension detected: high sodium meals will be excluded"
        })
    if profile.has_high_cholesterol:
        rule_trace.append({
            "rule_id": "R28",
            "condition_matched": "Patient has high cholesterol",
            "conclusion": "Fat constraint active — only low fat meals",
            "message": "High cholesterol detected: high fat meals will be excluded"
        })

    # R29: Fibre scoring preference for normal/post-op patients (SOFT CONSTRAINT - scoring, not hard filter)
    if profile.patient_category in ("normal", "post_operation"):
        rule_trace.append({
            "rule_id": "R29",
            "condition_matched": f"Patient category = {profile.patient_category}",
            "conclusion": "High fibre preference active — bonus scoring applied",
            "message": f"{profile.patient_category}: high-fibre meals receive scoring bonus (R58b), low-fibre meals receive penalty"
        })

    # R30: Oil constraint for high cholesterol patients
    if profile.has_high_cholesterol:
        rule_trace.append({
            "rule_id": "R30",
            "condition_matched": "Patient has high cholesterol",
            "conclusion": "Oil constraint active — exclude high oil meals",
            "message": "High cholesterol: high oil meals will be excluded"
        })

    # R31-R35: Allergy constraints
    if profile.allergies:
        for allergy in profile.allergies:
            allergy_rules = {
                "nut": "R31", "dairy": "R32", "egg": "R33",
                "seafood": "R34", "gluten": "R35"
            }
            rule_id = allergy_rules.get(allergy.lower(), "R35")
            rule_trace.append({
                "rule_id": rule_id,
                "condition_matched": f"Patient has {allergy} allergy",
                "conclusion": f"Exclude meals with {allergy}",
                "message": f"{allergy.title()} allergy: menus containing {allergy} will be excluded"
            })

    # R36-R39: Cycle day from calendar date
    cycle_day, weekday_name = get_cycle_day_from_date(menu_date)
    day_map = {
        "sunday": "R36", "thursday": "R36",
        "monday": "R37", "friday": "R37",
        "tuesday": "R38", "saturday": "R38",
        "wednesday": "R39"
    }
    day_rule = day_map.get(weekday_name, "R37")

    rule_trace.append({
        "rule_id": day_rule,
        "condition_matched": f"Day = {weekday_name.title()} ({menu_date or 'today'})",
        "conclusion": f"Menu day = {cycle_day}",
        "message": f"{weekday_name.title()} maps to menu cycle day {cycle_day}"
    })

    # R40-R42: Patient category filters
    if profile.is_vegetarian:
        rule_trace.append({
            "rule_id": "R40",
            "condition_matched": "Patient is vegetarian",
            "conclusion": "Vegetarian filter active",
            "message": "Vegetarian preference: only vegetarian meals allowed"
        })
    if profile.has_chewing_problem:
        rule_trace.append({
            "rule_id": "R41",
            "condition_matched": "Patient has chewing problem",
            "conclusion": "Chewing filter active",
            "message": "Chewing difficulty: only soft/chewing-friendly meals allowed"
        })
    # R42: Pre-operation low fibre preference (SOFT CONSTRAINT - scoring bonus, not hard filter)
    if profile.patient_category == "pre_operation":
        rule_trace.append({
            "rule_id": "R42",
            "condition_matched": "Patient is pre-operation",
            "conclusion": "Low fibre preference active — bonus scoring applied",
            "message": "Pre-op: low-fibre meals receive scoring bonus (R58c)"
        })

    # ======================================================
    # Candidate Search (R43-R62)
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

            # R45: Maximum calorie filter
            if menu.calories_kcal is not None and menu.calories_kcal > meal_targets[meal_time]:
                meal_rejected.append({
                    "menu_name": menu.menu_name,
                    "menu_code": menu.menu_code,
                    "reason": f"Calories {menu.calories_kcal} exceed target {meal_targets[meal_time]} kcal (R45)"
                })
                continue

            # R46-R54: Constraint filters
            passed, reject_reasons = passes_constraints(menu, profile)

            if not passed:
                reason_parts = []
                for r in reject_reasons:
                    if r == "high sugar": reason_parts.append("high sugar (R46)")
                    elif r == "high sodium": reason_parts.append("high sodium (R47)")
                    elif r == "high fat": reason_parts.append("high fat (R48)")
                    elif r == "not vegetarian": reason_parts.append("not vegetarian (R50)")
                    elif r == "not chewing friendly": reason_parts.append("not chewing-friendly (R51)")
                    # R52/R53 REMOVED — fibre is now soft constraint (scoring)
                    elif r == "not suitable for pregnancy": reason_parts.append("not pregnancy-safe")
                    elif r == "not suitable for pre_operation": reason_parts.append("not pre-op suitable")
                    elif r == "not suitable for post_operation": reason_parts.append("not post-op suitable")
                    elif r == "contains allergy ingredient":
                        allergies = profile.allergies or []
                        reason_parts.append(f"contains allergen ({', '.join(allergies)})")
                    elif r == "high oil": reason_parts.append("high oil (R54)")
                    else:
                        reason_parts.append(r)

                meal_rejected.append({
                    "menu_name": menu.menu_name,
                    "menu_code": menu.menu_code,
                    "reason": f"Failed safety filters: {', '.join(reason_parts)}"
                })
                continue

            # R56-R60: Scoring
            score, trace = score_menu(menu, profile)

            candidates.append({
                "menu": menu,
                "score": score,
                "trace": trace,
            })

        # R44: Minimum calorie threshold
        min_cal, _ = get_calorie_bounds(meal_targets[meal_time])
        filtered_candidates = []
        for c in candidates:
            if (c["menu"].calories_kcal or 0) >= min_cal:
                filtered_candidates.append(c)
            else:
                meal_rejected.append({
                    "menu_name": c["menu"].menu_name,
                    "menu_code": c["menu"].menu_code,
                    "reason": f"Calories {c['menu'].calories_kcal} below minimum {min_cal} kcal (R44)"
                })
        candidates = filtered_candidates

        # R62: No suitable candidate
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

        # R61: Select highest scoring candidate with deterministic tie-breaker
        def _tie_breaker(c):
            menu = c["menu"]
            deviation = abs((menu.calories_kcal or 0) - meal_targets[meal_time])
            return (-c["score"], deviation, menu.calories_kcal or 0)
        best_candidate = min(candidates, key=_tie_breaker)
        selected_menus[meal_time] = best_candidate["menu"]
        score_traces[meal_time] = best_candidate["trace"]
        no_suitable_alert[meal_time] = {"alert": False}

        # Log scoring rules applied
        for trace_entry in best_candidate["trace"]:
            if "R56" in trace_entry:
                rule_trace.append({
                    "rule_id": "R56",
                    "condition_matched": f"Preferred protein = {profile.preferred_protein}",
                    "conclusion": f"Menu protein type = {best_candidate['menu'].protein_type}",
                    "message": trace_entry
                })
            elif "R57" in trace_entry:
                rule_trace.append({
                    "rule_id": "R57",
                    "condition_matched": f"Preferred carbohydrate = {profile.preferred_carbohydrate}",
                    "conclusion": f"Menu carbohydrate type = {best_candidate['menu'].carbohydrate_type}",
                    "message": trace_entry
                })
            elif "R58" in trace_entry and "vegetarian" in trace_entry.lower():
                rule_trace.append({
                    "rule_id": "R58",
                    "condition_matched": "Patient is vegetarian",
                    "conclusion": "Vegetarian menu selected",
                    "message": trace_entry
                })
            elif "R58b" in trace_entry:
                rule_trace.append({
                    "rule_id": "R58b",
                    "condition_matched": f"Patient category = {profile.patient_category}, Menu fibre = {best_candidate['menu'].fibre_level}",
                    "conclusion": "Fibre scoring bonus/penalty applied",
                    "message": trace_entry
                })
            elif "R58c" in trace_entry:
                rule_trace.append({
                    "rule_id": "R58c",
                    "condition_matched": f"Patient category = pre_operation, Menu fibre = {best_candidate['menu'].fibre_level}",
                    "conclusion": "Low fibre scoring bonus applied",
                    "message": trace_entry
                })
            elif "R59" in trace_entry:
                rule_trace.append({
                    "rule_id": "R59",
                    "condition_matched": "Patient is post-operation",
                    "conclusion": "High protein menu selected",
                    "message": trace_entry
                })
            elif "R60" in trace_entry:
                rule_trace.append({
                    "rule_id": "R60",
                    "condition_matched": "No preference match",
                    "conclusion": "No scoring bonus applied",
                    "message": trace_entry
                })

        rule_trace.append({
            "rule_id": "R61",
            "condition_matched": f"{len(candidates)} candidates for {meal_time}",
            "conclusion": f"Selected {best_candidate['menu'].menu_name} (score: {best_candidate['score']})",
            "message": f"Highest scoring menu for {meal_time}: {best_candidate['menu'].menu_name} with score {best_candidate['score']}"
        })

        rejected_menus.extend(meal_rejected)

    # R63: Recommendation generated
    if any(ns.get("alert", False) for ns in no_suitable_alert.values()):
        status = "needs_dietitian_action"
        rule_trace.append({
            "rule_id": "R62",
            "condition_matched": "No candidate meal exists after safety filters and minimum thresholds",
            "conclusion": "Dietitian modification required",
            "message": "No suitable menu found for one or more meals. Dietitian must review manually."
        })
    else:
        status = "pending_review"

    rule_trace.append({
        "rule_id": "R63",
        "condition_matched": "Menu recommendation generated",
        "conclusion": f"Status = {status}",
        "message": f"Recommendation created with status: {status}"
    })

    # ======================================================
    # Save Recommendation
    # ======================================================

    # Parse menu date for storage and duplicate check
    from datetime import datetime as _dt
    if menu_date:
        menu_date_obj = _dt.strptime(menu_date, "%Y-%m-%d").date()
    else:
        menu_date_obj = _dt.now(timezone.utc).date()

    # Prevent duplicate recommendations for the same patient + menu date
    existing = (
        db.query(Recommendation)
        .filter(Recommendation.patient_id == patient.id, Recommendation.menu_date == menu_date_obj)
        .first()
    )
    if existing:
        raise ValueError(f"Recommendation already exists for {menu_date_obj}")

    recommendation = Recommendation(
        patient_id=patient.id,
        cycle_day=cycle_day,
        menu_date=menu_date_obj,
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
