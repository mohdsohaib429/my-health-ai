import axios from 'axios';

const USDA_API_KEY = process.env.USDA_API_KEY;

export interface NutritionInfo {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  unit: string;
}

export async function lookupNutrition(foodQuery: string): Promise<NutritionInfo | null> {
  if (!USDA_API_KEY) {
    console.error('USDA_API_KEY is not defined.');
    return null;
  }

  try {
    // USDA FDC API search endpoint
    const searchUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(foodQuery)}&pageSize=1`;
    
    const response = await axios.get(searchUrl);
    
    if (response.data.foods && response.data.foods.length > 0) {
      const food = response.data.foods[0];
      
      // Extract nutrients (normalized per 100g)
      const nutrients = food.foodNutrients || [];
      const getNutrient = (id: number) => nutrients.find((n: any) => n.nutrientId === id)?.value || 0;

      // Nutrient IDs for FDC: 
      // 1008: Energy (kcal), 1003: Protein, 1005: Carbs, 1004: Fat, 1079: Fiber
      return {
        foodName: food.description,
        calories: getNutrient(1008),
        protein: getNutrient(1003),
        carbs: getNutrient(1005),
        fat: getNutrient(1004),
        fiber: getNutrient(1079),
        unit: 'g' // normalized basis
      };
    }
  } catch (error) {
    console.error('Error fetching nutrition data from USDA API:', error);
  }
  
  return null;
}
