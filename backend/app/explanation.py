# Explanation generation for recommendations
# app/explanation.py

from typing import Dict, Any, List, Optional


def build_explanation(
    patient,
    profile,
    bmi: float,
    bmi_category: str,
    age_category: str,
    final_daily_calories: int,
    meal_targets: dict,
    selected_menus: dict,
    score_traces: dict,
    constraints: list,
    rejected_menus: Optional[List[dict]] = None,
):
    """
    Human-readable explanation saved into Recommendation.explanation_json
    """

    recommendations = {}
    rejected_explanations = []

    for meal_time, menu in selected_menus.items():

        if menu is None:
            recommendations[meal_time] = {
                "menu": None,
                "reason": "No suitable menu found. Dietitian action required (R62)."
            }
            continue

        recommendations[meal_time] = {
            "menu": menu.menu_name,
            "menu_code": menu.menu_code,
            "calories": menu.calories_kcal,
            "score_reasons": score_traces.get(meal_time, [])
        }

    # Build rejected explanations
    if rejected_menus:
        for rejected in rejected_menus:
            rejected_explanations.append({
                "meal_time": rejected.get("meal_time", "unknown"),
                "menu_name": rejected["menu_name"],
                "menu_code": rejected.get("menu_code", "—"),
                "reason": rejected["reason"]
            })

    return {
        "patient_name": patient.full_name,
        "patient_code": patient.patient_code,
        "bmi": bmi,
        "bmi_category": bmi_category,
        "age_category": age_category,
        "daily_calories": final_daily_calories,
        "meal_targets": meal_targets,
        "constraints": constraints,
        "recommendations": recommendations,
        "rejected_explanations": rejected_explanations,
        "summary": _build_summary(
            patient, bmi, bmi_category, final_daily_calories, 
            selected_menus, rejected_menus
        ),
    }


def _build_summary(
    patient, bmi, bmi_category, final_daily_calories, 
    selected_menus, rejected_menus
):
    """Build a human-readable summary paragraph."""

    parts = [
        f"Recommendation for {patient.full_name} (BMI {bmi}, {bmi_category}).",
        f"Daily calorie target: {final_daily_calories} kcal."
    ]

    selected_count = sum(1 for m in selected_menus.values() if m is not None)
    total_meals = len(selected_menus)

    if selected_count == total_meals:
        parts.append(f"All {total_meals} meals successfully matched.")
    else:
        parts.append(f"{selected_count}/{total_meals} meals matched. Dietitian review required for missing meals.")

    if rejected_menus:
        parts.append(f"{len(rejected_menus)} menu options excluded due to safety constraints.")

    return " ".join(parts)
