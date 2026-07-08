# CORRECTED RULE LIST

> Use this to replace the original **"FACTS AND RULES LATEST"** section in your report.
> The calorie formula, rule numbering, and missing constraints have been updated to match the final system.

---

## LIST OF FACTS

**Patient Identity Facts**

| F1: | Patient weight in kg | F6: | Patient ID |
| :---- | :---- | :---- | :---- |
| F2: | Patient height in cm | F7: | Patient name |
| F3: | Patient age in years | F8: | Ward number |
| F4: | Gender is male | F9: | Admission date |
| F5: | Gender is female |  |  |

**Medical Condition Facts**

| F10: | Patient has diabetes | F12: | Patient has high cholesterol |
| :---- | :---- | :---- | :---- |
| F11: | Patient has hypertension | F13: | Patient has no disease |

**Allergy Facts**

| F14: | Patient has nut allergy | F17: | Patient has seafood allergy |
| :---- | :---- | :---- | :---- |
| F15: | Patient has dairy allergy | F18: | Patient has gluten allergy |
| F16: | Patient has egg allergy | F19: | Patient has no allergy |

**Lifestyle and Physical Condition Facts**

| F20: | Activity level is sedentary | F26: | Patient smokes |
| :---- | :---- | :---- | :---- |
| F21: | Activity level is moderate | F27: | Patient does not smoke |
| F22: | Activity level is active | F28: | Patient is vegetarian |
| F23: | Sleep pattern is good | F29: | Patient is not vegetarian |
| F24: | Sleep pattern is irregular | F30: | Patient has chewing problem |
| F25: | Sleep pattern is poor | F31: | Patient does not have chewing problem |

**Preference Facts**

| F32: | Preferred protein is chicken | F36: | No protein preference |
| :---- | :---- | :---- | :---- |
| F33: | Preferred protein is fish | F37: | Preferred carbohydrate is white rice |
| F34: | Preferred protein is egg | F38: | Preferred carbohydrate is noodle |
| F35: | Preferred protein is tofu | F39: | No carbohydrate preference |

**Day and Meal Facts**

| F40: | Day is Sunday | F45: | Day is Friday |
| :---- | :---- | :---- | :---- |
| F41: | Day is Monday | F46: | Day is Saturday |
| F42: | Day is Tuesday | F47: | Meal type is breakfast |
| F43: | Day is Wednesday | F48: | Meal type is lunch |
| F44: | Day is Thursday | F49: | Meal type is dinner |

**Patient Category Facts**

| F50: | Patient category is normal | F54: | Pregnancy trimester is 1 |
| :---- | :---- | :---- | :---- |
| F51: | Patient category is pre-operation | F55: | Pregnancy trimester is 2 |
| F52: | Patient category is post-operation | F56: | Pregnancy trimester is 3 |
| F53: | Patient category is pregnant |  |  |

**Generated Facts**

| NF1: | BMI value | NF20: | Menu day is 1 |
| :---- | :---- | :---- | :---- |
| NF2: | BMI category is underweight | NF21: | Menu day is 2 |
| NF3: | BMI category is normal | NF22: | Menu day is 3 |
| NF4: | BMI category is overweight | NF23: | Menu day is 4 |
| NF5: | BMI category is obese | NF24: | Vegetarian filter is active |
| NF6: | Age category is child | NF25: | Chewing filter is active |
| NF7: | Age category is teenager | NF26: | Low fibre filter is active |
| NF8: | Age category is adult | NF27: | Candidate meal list |
| NF9: | BMR value | NF28: | Meal score |
| NF10: | Activity-adjusted calories | NF29: | Recommended breakfast meal |
| NF11: | Growth adjustment | NF30: | Recommended lunch meal |
| NF12: | Category adjustment | NF31: | Recommended dinner meal |
| NF13: | Final daily calories | NF32: | Recommendation status is pending review |
| NF14: | Breakfast kcal target | NF33: | Recommendation status is approved |
| NF15: | Lunch kcal target | NF34: | Recommendation status is rejected |
| NF16: | Dinner kcal target | NF35: | Dietitian modification required |
| NF17: | Sugar constraint is active |  |  |
| NF18: | Sodium constraint is active |  |  |
| NF19: | Fat constraint is active |  |  |

---

## LIST OF RULES

### BMI Rules

| R1: | IF Weight > 0 AND height > 0 THEN BMI = weight / height in metres squared |
| :---- | :---- |
| R2: | IF BMI < 18.5 THEN BMI category = underweight |
| R3: | IF BMI >= 18.5 AND BMI < 25.0 THEN BMI category = normal |
| R4: | IF BMI >= 25.0 AND BMI < 30.0 THEN BMI category = overweight |
| R5: | IF BMI >= 30.0 THEN BMI category = obese |

### Age Category Rules

| R6: | IF Age >= 7 AND age < 13 THEN Age category = child |
| :---- | :---- |
| R7: | IF Age >= 13 AND age < 18 THEN Age category = teenager |
| R8: | IF Age >= 18 THEN Age category = adult |

### Basal Metabolic Rate (BMR) Rule

| R9: | IF Weight > 0 AND height > 0 AND age > 0 AND gender is known THEN BMR = (10 × weight) + (6.25 × height) − (5 × age) + gender_offset, where gender_offset = 5 if male, −161 if female |
| :---- | :---- |

### Activity Multiplier Rules

| R10: | IF Activity level = sedentary THEN Activity-adjusted calories = BMR × 1.2 |
| :---- | :---- |
| R11: | IF Activity level = moderate THEN Activity-adjusted calories = BMR × 1.375 |
| R12: | IF Activity level = active THEN Activity-adjusted calories = BMR × 1.55 |

### Growth Adjustment Rules

| R13: | IF Age category = child THEN Growth adjustment = +200 kcal |
| :---- | :---- |
| R14: | IF Age category = teenager THEN Growth adjustment = +100 kcal |
| R15: | IF Age category = adult THEN Growth adjustment = 0 kcal |

### Patient Category Adjustment Rules

| R16: | IF Patient category = normal THEN Patient category calorie adjustment = 0 |
| :---- | :---- |
| R17: | IF Patient category = pregnant AND trimester = 1 THEN Patient category calorie adjustment = +300 |
| R18: | IF Patient category = pregnant AND trimester = 2 THEN Patient category calorie adjustment = +350 |
| R19: | IF Patient category = pregnant AND trimester = 3 (or unspecified) THEN Patient category calorie adjustment = +500 |
| R20: | IF Patient category = pre-operation THEN Patient category calorie adjustment = −200 |
| R21: | IF Patient category = post-operation THEN Patient category calorie adjustment = +200 |

### Final Daily Calorie Rule

| R22: | IF Activity-adjusted calories is known AND growth adjustment is known AND patient category calorie adjustment is known THEN Final daily calories = activity-adjusted + growth + category adjustment |
| :---- | :---- |

### Meal Calorie Target Rules

| R23: | IF Final daily calories is known AND meal type = breakfast THEN Breakfast kcal target = final daily calories × 0.25 |
| :---- | :---- |
| R24: | IF Final daily calories is known AND meal type = lunch THEN Lunch kcal target = final daily calories × 0.40 |
| R25: | IF Final daily calories is known AND meal type = dinner THEN Dinner kcal target = final daily calories × 0.35 |

### Medical Constraint Rules

| R26: | IF Patient has diabetes THEN Sugar constraint is active: allow only meals with sugar level = low |
| :---- | :---- |
| R27: | IF Patient has hypertension THEN Sodium constraint is active: allow only meals with sodium level = low |
| R28: | IF Patient has high cholesterol THEN Fat constraint is active: allow only meals with fat level = low |
| R29: | IF Patient category = normal OR post-operation THEN Fibre constraint is active: exclude meals with low fibre |
| R30: | IF Patient has high cholesterol THEN Oil constraint is active: exclude meals with high oil |

### Allergy Exclusion Rules

| R31: | IF Patient has nut allergy THEN Add `nut` to allergy exclusion list |
| :---- | :---- |
| R32: | IF Patient has dairy allergy THEN Add `dairy` to allergy exclusion list |
| R33: | IF Patient has egg allergy THEN Add `egg` to allergy exclusion list |
| R34: | IF Patient has seafood allergy THEN Add `seafood` to allergy exclusion list |
| R35: | IF Patient has gluten allergy THEN Add `gluten` to allergy exclusion list |

### Day Mapping Rules

| R36: | IF Day = Sunday OR day = Thursday THEN Menu day = 1 |
| :---- | :---- |
| R37: | IF Day = Monday OR day = Friday THEN Menu day = 2 |
| R38: | IF Day = Tuesday OR day = Saturday THEN Menu day = 3 |
| R39: | IF Day = Wednesday THEN Menu day = 4 |

### Patient Category Filter Rules

| R40: | IF Patient is vegetarian THEN Vegetarian filter is active |
| :---- | :---- |
| R41: | IF Patient has chewing problem THEN Chewing filter is active |
| R42: | IF Patient category = pre-operation THEN Low fibre filter is active |

### Candidate Meal Selection Rules

| R43: | IF Meal day = menu day AND meal type = current meal type THEN Meal passes day and meal type filter |
| :---- | :---- |
| R44: | IF Meal calories >= 50% of target kcal for the current meal type THEN Meal passes minimum calorie filter |
| R45: | IF Meal calories <= target kcal for the current meal type THEN Meal passes maximum calorie filter |
| R46: | IF Sugar constraint is active AND meal sugar level = low THEN Meal passes sugar filter |
| R47: | IF Sodium constraint is active AND meal sodium level = low THEN Meal passes sodium filter |
| R48: | IF Fat constraint is active AND meal fat level = low THEN Meal passes fat filter |
| R49: | IF Meal allergy tags do not contain any allergy in allergy exclusion list THEN Meal passes allergy filter |
| R50: | IF Vegetarian filter is active AND meal vegetarian = yes THEN Meal passes vegetarian filter |
| R51: | IF Chewing filter is active AND meal suitable for chewing problem = yes THEN Meal passes chewing filter |
| R52: | IF Low fibre filter is active AND meal fibre level = low THEN Meal passes low fibre filter |
| R53: | IF Fibre constraint is active AND meal fibre level != low THEN Meal passes adequate fibre filter |
| R54: | IF Oil constraint is active AND meal oil level = low THEN Meal passes oil filter |
| R55: | IF Meal passes all required active filters THEN Meal = candidate |

### Scoring Rules

| R56: | IF Candidate meal protein type = preferred protein THEN Meal score = meal score + 30 |
| :---- | :---- |
| R57: | IF Candidate meal carbohydrate type = preferred carbohydrate THEN Meal score = meal score + 20 |
| R58: | IF Patient is vegetarian AND candidate meal vegetarian = yes THEN Meal score = meal score + 10 |
| R59: | IF Patient category = post-operation AND candidate meal protein level = high THEN Meal score = meal score + 40 |
| R60: | IF Candidate meal has no preference match THEN Meal score = meal score + 0 |
| R61: | IF Candidate meals exist for a meal type THEN Recommend candidate meal with highest score; tie-breaker = lowest calorie deviation from target |
| R62: | IF No candidate meal exists after required safety filters THEN Dietitian modification required |

### Approval Workflow Rules

| R63: | IF Menu recommendation is generated THEN Recommendation status = pending review |
| :---- | :---- |
| R64: | IF Dietitian approves recommendation THEN Recommendation status = approved |
| R65: | IF Dietitian modifies recommendation THEN Recommendation status = modified |
| R66: | IF Dietitian rejects recommendation THEN Recommendation status = rejected |
| R67: | IF Recommendation status = approved THEN Patient can view menu |
| R68: | IF Recommendation status is pending review OR rejected THEN Patient cannot view menu yet |

| **R43-R55** | R49-R58 (candidate filters) | Shifted +1; added R44 (minimum threshold) |
| **R56-R62** | R59-R65 (scoring) | Shifted +1 |
| **R63-R68** | R66-R71 (approval) | Shifted +1 |
