# app/rules.py

from datetime import datetime, date
from typing import Dict, List, Tuple


# ==========================================================
# BMI RULES (R1-R5)
# ==========================================================

def calculate_bmi(weight_kg: float, height_cm: float) -> float:
    """
    R1: BMI = weight / height(m)^2
    """
    if not weight_kg or not height_cm:
        raise ValueError("Weight and height must be greater than zero")

    height_m = float(height_cm) / 100
    return round(float(weight_kg) / (height_m ** 2), 2)


def get_bmi_category(bmi: float) -> str:
    """
    R2-R5
    """
    if bmi < 18.5:
        return "underweight"

    if bmi < 25:
        return "normal"

    if bmi < 30:
        return "overweight"

    return "obese"


# ==========================================================
# AGE CATEGORY RULES (R6-R8)
# ==========================================================

def get_age_category(age: int) -> str:
    if age < 13:
        return "child"

    if age < 18:
        return "teenager"

    return "adult"


# ==========================================================
# BMR + ACTIVITY MULTIPLIER RULES (R9-R12)
# ==========================================================

CALORIE_FACTORS = {
    ("overweight", "sedentary"): 20,
    ("overweight", "moderate"): 22,
    ("overweight", "active"): 25,

    ("normal", "sedentary"): 30,
    ("normal", "moderate"): 35,
    ("normal", "active"): 40,

    ("underweight", "sedentary"): 35,
    ("underweight", "moderate"): 40,
    ("underweight", "active"): 45,
}


def get_calorie_factor(
    bmi_category: str,
    activity_level: str
) -> int:

    return CALORIE_FACTORS.get(
        (bmi_category.lower(), activity_level.lower()),
        30
    )


# ==========================================================
# DAILY CALORIE RULES (R9-R22)
# ==========================================================

def calculate_daily_calories(
    weight_kg: float,
    age: int,
    height_cm: float,
    gender: str,
    activity_level: str,
    patient_category: str,
    pregnancy_trimester: int | None = None
) -> int:
    """
    Returns Final Daily Calories using Mifflin-St Jeor equation.
    """
    # R9: Basal Metabolic Rate
    bmr = (10 * float(weight_kg)) + (6.25 * float(height_cm)) - (5 * age)
    if gender.lower() == "male":
        bmr += 5
    else:
        bmr -= 161

    # R10-R12: Activity multiplier
    multipliers = {"sedentary": 1.2, "moderate": 1.375, "active": 1.55}
    activity_multiplier = multipliers.get(activity_level.lower(), 1.2)
    activity_adjusted = bmr * activity_multiplier

    # R13-R15: Growth adjustment (children & teens need MORE, not less)
    growth_adjustment = 0
    if age < 13:
        growth_adjustment = 200
    elif age < 18:
        growth_adjustment = 100

    # R16-R21: Category adjustment
    adjustment = 0
    if patient_category == "pregnant":
        if pregnancy_trimester == 1:
            adjustment = 300
        elif pregnancy_trimester == 2:
            adjustment = 350
        else:
            adjustment = 500  # trimester 3 OR default if not specified
    elif patient_category == "pre_operation":
        adjustment = -200
    elif patient_category == "post_operation":
        adjustment = 200

    return int(round(activity_adjusted + growth_adjustment + adjustment))


def get_calorie_bounds(target: int) -> tuple[int, int]:
    """Returns (minimum, maximum) acceptable calories for a meal.

    NOTE: This function is now only kept for backward compatibility / reference.
    Calorie bounds are NO LONGER used as hard filters in the inference engine.
    Calorie matching has been moved to soft scoring (see score_menu).
    """
    return int(target * 0.5), int(target * 1.0)


# ==========================================================
# MEAL TARGET RULES (R23-R25)
# ==========================================================

def calculate_meal_targets(
    final_daily_calories: int
) -> Dict[str, int]:

    return {
        "breakfast": int(round(final_daily_calories * 0.25)),
        "lunch": int(round(final_daily_calories * 0.40)),
        "dinner": int(round(final_daily_calories * 0.35)),
    }


# ==========================================================
# MENU DAY RULES (R36-R39) — NOW ACCEPTS FULL DATE
# ==========================================================

def get_cycle_day_from_date(input_date: date | datetime | str | None = None) -> tuple[int, str]:
    """
    NEW: Accepts a full date (from your calendar picker) and returns:
        (cycle_day, weekday_name)

    Supports:
        - date object (from calendar picker)
        - datetime object
        - ISO string "2026-06-24"
        - None (uses today)

    R36: Sunday or Thursday → Menu day 1
    R37: Monday or Friday → Menu day 2
    R38: Tuesday or Saturday → Menu day 3
    R39: Wednesday → Menu day 4
    """

    # Parse input
    if input_date is None:
        dt = datetime.now()
    elif isinstance(input_date, str):
        dt = datetime.fromisoformat(input_date.replace('Z', '+00:00'))
    elif isinstance(input_date, date) and not isinstance(input_date, datetime):
        dt = datetime.combine(input_date, datetime.min.time())
    else:
        dt = input_date

    weekday = dt.weekday()  # Monday=0, Sunday=6
    weekday_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    weekday_name = weekday_names[weekday]

    mapping = {
        6: (1, "sunday"),      # Sunday
        3: (1, "thursday"),    # Thursday
        0: (2, "monday"),      # Monday
        4: (2, "friday"),      # Friday
        1: (3, "tuesday"),     # Tuesday
        5: (3, "saturday"),    # Saturday
        2: (4, "wednesday"),   # Wednesday
    }

    cycle_day, _ = mapping[weekday]
    return cycle_day, weekday_name


# Legacy: keep for backward compatibility
def get_cycle_day(current_date: datetime | None = None) -> int:
    """Legacy: uses system date."""
    cd, _ = get_cycle_day_from_date(current_date)
    return cd


def get_cycle_day_from_weekday(weekday: str) -> int:
    """Legacy: from weekday string."""
    mapping = {
        "sunday": 1, "thursday": 1,
        "monday": 2, "friday": 2,
        "tuesday": 3, "saturday": 3,
        "wednesday": 4,
    }
    return mapping.get(weekday.lower(), 2)


# ==========================================================
# MEDICAL CONSTRAINTS
# ==========================================================

def build_constraints(profile) -> List[str]:

    constraints = []

    if profile.has_diabetes:
        constraints.append("low_sugar")

    if profile.has_hypertension:
        constraints.append("low_sodium")

    if profile.has_high_cholesterol:
        constraints.append("low_fat")

    if profile.is_vegetarian:
        constraints.append("vegetarian")

    if profile.has_chewing_problem:
        constraints.append("chewing")

    if profile.patient_category == "pregnant":
        constraints.append("pregnant")

    if profile.patient_category == "pre_operation":
        constraints.append("pre_operation")
        constraints.append("low_fibre")   # R47

    if profile.patient_category == "post_operation":
        constraints.append("post_operation")

    return constraints


# ==========================================================
# SAFETY FILTERS (R46-R55)
# ==========================================================

def passes_constraints(
    menu,
    profile
) -> Tuple[bool, List[str]]:

    reasons = []

    # R46: Sugar constraint
    if profile.has_diabetes and menu.sugar_level.lower() == "high":
        reasons.append("high sugar")

    # R47: Sodium constraint
    if profile.has_hypertension and menu.sodium_level.lower() == "high":
        reasons.append("high sodium")

    # R48: Fat constraint
    if profile.has_high_cholesterol and menu.fat_level.lower() == "high":
        reasons.append("high fat")

    # R53 REMOVED: Fibre moved to scoring (soft constraint)
    # R54: Oil constraint for high cholesterol patients
    if (
        profile.has_high_cholesterol
        and menu.oil_level.lower() == "high"
    ):
        reasons.append("high oil")

    # R50: Vegetarian filter
    if profile.is_vegetarian and not menu.vegetarian:
        reasons.append("not vegetarian")

    # R51: Chewing filter
    if profile.has_chewing_problem and not menu.suitable_chewing:
        reasons.append("not chewing friendly")

    # R52 REMOVED: Fibre moved to scoring (soft constraint)
    # Pregnancy suitability
    if (
        profile.patient_category == "pregnant"
        and not menu.suitable_pregnant
    ):
        reasons.append("not suitable for pregnancy")

    # Pre-op suitability
    if (
        profile.patient_category == "pre_operation"
        and not menu.suitable_preop
    ):
        reasons.append("not suitable for pre_operation")

    # Post-op suitability
    if (
        profile.patient_category == "post_operation"
        and not menu.suitable_postop
    ):
        reasons.append("not suitable for post_operation")

    # R49: Allergy exclusion
    patient_allergies = {
        allergy.lower()
        for allergy in (profile.allergies or [])
    }

    menu_allergies = {
        allergy.lower()
        for allergy in (menu.allergy_tags or [])
    }

    if patient_allergies.intersection(menu_allergies):
        reasons.append("contains allergy ingredient")

    return len(reasons) == 0, reasons


# ==========================================================
# SCORING RULES (R56-R60) + CALORIE PROXIMITY (SOFT)
# ==========================================================

def score_menu(
    menu,
    profile,
    target_calories: float | None = None,
) -> tuple[int, List[str]]:

    score = 0
    trace = []

    # ========================================================
    # CALORIE PROXIMITY BONUS (soft constraint — never excludes)
    # Replaces old R44 (min 50% of target) and R45 (hard ceiling
    # at 100% of target). Closer to target = higher bonus, but a
    # menu is NEVER rejected purely for calorie deviation.
    # ========================================================
    if menu.calories_kcal is not None and target_calories and target_calories > 0:
        deviation_pct = abs(menu.calories_kcal - target_calories) / target_calories
        calorie_bonus = max(0, int(20 * (1 - deviation_pct)))
        if calorie_bonus > 0:
            score += calorie_bonus
            trace.append(
                f"+{calorie_bonus} calorie proximity "
                f"(target: {int(target_calories)}, actual: {menu.calories_kcal})"
            )

    # R56: Preferred protein
    if (
        profile.preferred_protein
        and profile.preferred_protein != "none"
        and menu.protein_type == profile.preferred_protein
    ):
        score += 30
        trace.append("+30 preferred protein match (R56)")

    # R57: Preferred carbohydrate
    if (
        profile.preferred_carbohydrate
        and profile.preferred_carbohydrate != "none"
        and menu.carbohydrate_type == profile.preferred_carbohydrate
    ):
        score += 20
        trace.append("+20 preferred carbohydrate match (R57)")

    # R58: Vegetarian bonus
    if (
        profile.is_vegetarian
        and menu.vegetarian
    ):
        score += 10
        trace.append("+10 vegetarian match (R58)")

    # R59: Post-operation high protein
    if (
        profile.patient_category == "post_operation"
        and menu.protein_level.lower() == "high"
    ):
        score += 40
        trace.append("+40 post-op high protein (R59)")

    # R58b: Fibre bonus for normal/post-op patients (soft constraint)
    if profile.patient_category in ("normal", "post_operation"):
        if menu.fibre_level.lower() == "high":
            score += 15
            trace.append("+15 high fibre bonus (R58b)")
        elif menu.fibre_level.lower() == "low":
            score -= 5
            trace.append("-5 low fibre penalty (R58b)")

    # R58c: Pre-op low fibre bonus (soft constraint)
    if profile.patient_category == "pre_operation":
        if menu.fibre_level.lower() == "low":
            score += 10
            trace.append("+10 low fibre for pre-op (R58c)")

    # R60: No preference match
    if score == 0:
        trace.append("+0 no preference match (R60)")

    return score, trace
