/**
 * Treatment knowledge base for the eight classes emitted by
 * `src/ml-service/tea_trained_model.keras`.
 *
 * The model was trained on folder names, so its raw labels are inconsistent
 * ("Anthracnose" is capitalised, "gray light" is the dataset's typo for gray
 * blight). Everything here is keyed on a normalised form of the raw label,
 * with aliases so a future retrain with cleaner labels keeps resolving.
 */

export type DiseaseSeverity = "healthy" | "low" | "moderate" | "high";

export type TreatmentStep = {
  title: string;
  detail: string;
};

export type DiseaseInfo = {
  key: string;
  label: string;
  labelSi: string;
  pathogen: string;
  severity: DiseaseSeverity;
  summary: string;
  symptoms: string[];
  treatments: TreatmentStep[];
  prevention: string[];
};

/** Raw class list, in the exact order the Keras model outputs them. */
export const MODEL_CLASS_NAMES = [
  "Anthracnose",
  "algal leaf",
  "bird eye spot",
  "brown blight",
  "gray light",
  "healthy",
  "red leaf spot",
  "white spot",
] as const;

/** The square input size the model expects, mirrored from predict_tea_disease.py. */
export const MODEL_INPUT_SIZE = 128;

export const SEVERITY_META: Record<
  DiseaseSeverity,
  { label: string; chip: string; icon: string; bar: string; stroke: string }
> = {
  healthy: {
    label: "Healthy",
    chip: "bg-leaf-soft text-leaf-strong",
    icon: "gradient-leaf text-primary-foreground",
    bar: "bg-[image:var(--gradient-leaf)]",
    stroke: "oklch(0.62 0.15 146)",
  },
  low: {
    label: "Low severity",
    chip: "bg-amber-100 text-amber-800",
    icon: "bg-amber-100 text-amber-700",
    bar: "bg-amber-500",
    stroke: "oklch(0.77 0.16 70)",
  },
  moderate: {
    label: "Moderate severity",
    chip: "bg-orange-100 text-orange-800",
    icon: "bg-orange-100 text-orange-700",
    bar: "bg-orange-500",
    stroke: "oklch(0.7 0.19 48)",
  },
  high: {
    label: "High severity",
    chip: "bg-red-100 text-red-700",
    icon: "bg-red-100 text-red-600",
    bar: "bg-red-500",
    stroke: "oklch(0.64 0.21 25)",
  },
};

const HEALTHY: DiseaseInfo = {
  key: "healthy",
  label: "Healthy Leaf",
  labelSi: "නිරෝගී පත්‍රය",
  pathogen: "No pathogen detected",
  severity: "healthy",
  summary:
    "No disease symptoms were found on this leaf. The bush looks to be in good condition.",
  symptoms: [
    "Even green colour with no spots, lesions or discolouration",
    "Firm, undamaged leaf margin and tip",
    "No velvety, powdery or rust-coloured growth on either surface",
  ],
  treatments: [
    {
      title: "Keep your current routine",
      detail:
        "No treatment is needed. Continue the same plucking round, weeding schedule and shade management you are using now.",
    },
    {
      title: "Re-scan after heavy rain",
      detail:
        "Most tea leaf diseases only show up 5 to 10 days after a long wet spell. Scan a few leaves from each block once the rain settles.",
    },
    {
      title: "Keep the record",
      detail:
        "Save this scan against the block name. A clean scan history is what factory buyers look at when they compare suppliers.",
    },
  ],
  prevention: [
    "Keep potash levels up, since well-fed bushes resist leaf fungi far better",
    "Clear the drains so water never stagnates around the collar",
    "Sterilise shears and pruning knives before moving between blocks",
    "Regulate shade so the canopy dries quickly after rain",
  ],
};

const DISEASES: DiseaseInfo[] = [
  HEALTHY,
  {
    key: "anthracnose",
    label: "Anthracnose",
    labelSi: "ඇන්ත්‍රැක්නෝස්",
    pathogen: "Colletotrichum spp.",
    severity: "high",
    summary:
      "A fungal blight that kills leaf tissue in spreading brown patches, usually starting at the tip or margin. It moves fast in warm, wet weather and can strip young bushes.",
    symptoms: [
      "Dark brown to greyish dead patches starting at the leaf tip or edge",
      "Faint concentric rings inside the older part of the lesion",
      "A narrow yellow halo where dead tissue meets healthy tissue",
      "Tiny black fruiting dots scattered over the dried centre",
    ],
    treatments: [
      {
        title: "Remove and destroy infected material",
        detail:
          "Pluck off affected leaves and prune out dead shoots, then burn or bury them well away from the field. Never leave them lying between the rows, because they keep releasing spores.",
      },
      {
        title: "Spray a protectant fungicide",
        detail:
          "Apply copper oxychloride or mancozeb to run-off, wetting both leaf surfaces. Repeat after 10 to 14 days for as long as wet weather continues.",
      },
      {
        title: "Sanitise your tools",
        detail:
          "Wipe plucking shears and pruning knives with disinfectant before moving to the next block. The fungus enters through fresh cuts.",
      },
      {
        title: "Correct the nutrition",
        detail:
          "Apply a potash-rich fertiliser. Bushes short of potassium stay infected far longer and recover poorly.",
      },
    ],
    prevention: [
      "Open up the canopy so leaves dry within a few hours of rain",
      "Avoid hard plucking on stressed or drought-hit bushes",
      "Keep drainage channels clear through the monsoon",
      "Burn prunings instead of stacking them in the field",
    ],
  },
  {
    key: "algal leaf spot",
    label: "Algal Leaf Spot",
    labelSi: "ඇල්ගී පත්‍ර ලප",
    pathogen: "Cephaleuros virescens (parasitic green alga)",
    severity: "low",
    summary:
      "A parasitic alga rather than a fungus. It rarely kills a bush, but heavy infection on shaded, poorly drained fields cuts leaf area and lowers made-tea quality.",
    symptoms: [
      "Raised orange to rust-red velvety patches on the upper leaf surface",
      "Roughly circular spots, 2 to 10 mm across, with a slightly fringed edge",
      "Patches that can be scraped off, leaving a pale scar underneath",
      "Worst on older leaves of heavily shaded, damp bushes",
    ],
    treatments: [
      {
        title: "Cut back the shade",
        detail:
          "Thin the shade trees and open the canopy. Algal spot needs long leaf wetness, so more light and airflow alone will slow it down sharply.",
      },
      {
        title: "Fix the drainage",
        detail:
          "Clear silted drains and break up compacted soil so the block stops holding water after rain.",
      },
      {
        title: "Apply a copper spray if it is spreading",
        detail:
          "Copper oxychloride or Bordeaux mixture controls the alga well. One or two rounds during the wet season are normally enough.",
      },
      {
        title: "Remove the worst leaves",
        detail:
          "Strip heavily crusted older leaves during the next plucking round to cut the amount of inoculum in the block.",
      },
    ],
    prevention: [
      "Keep shade at the recommended level instead of letting it thicken",
      "Maintain drains before the monsoon rather than after",
      "Avoid overhead irrigation late in the day",
      "Keep bushes vigorous with balanced fertiliser",
    ],
  },
  {
    key: "bird eye spot",
    label: "Bird's Eye Spot",
    labelSi: "කුරුළු ඇස් ලප",
    pathogen: "Cercospora theae",
    severity: "moderate",
    summary:
      "Named for the pale centre ringed by a dark border that looks like a bird's eye. It hits young leaves and nursery plants hardest, especially where plants are sun-scorched or under moisture stress.",
    symptoms: [
      "Small circular spots, 1 to 3 mm, with a white or pale grey centre",
      "A distinct brown to purple-black ring around each spot",
      "Many spots per leaf, which merge on badly affected leaves",
      "Concentrated on tender young leaves and nursery stock",
    ],
    treatments: [
      {
        title: "Shade the nursery properly",
        detail:
          "Bird's eye spot follows sun scorch and moisture stress. Get nursery shade back to the recommended level before doing anything else.",
      },
      {
        title: "Space the plants out",
        detail:
          "Thin overcrowded nursery beds so air moves between the plants and leaves dry faster after watering.",
      },
      {
        title: "Spray a copper fungicide",
        detail:
          "Apply copper oxychloride at 10 to 14 day intervals while wet weather lasts, covering the undersides of the young leaves.",
      },
      {
        title: "Remove the affected leaves",
        detail:
          "Strip and destroy badly spotted leaves from nursery plants so spores do not wash onto the new flush.",
      },
    ],
    prevention: [
      "Water nursery plants early in the day, not in the evening",
      "Keep young plants out of direct afternoon sun",
      "Do not let nursery beds dry out and then flood them",
      "Inspect new planting material before it enters the field",
    ],
  },
  {
    key: "brown blight",
    label: "Brown Blight",
    labelSi: "දුඹුරු අංගමාරය",
    pathogen: "Colletotrichum camelliae / Glomerella cingulata",
    severity: "high",
    summary:
      "A wound and stress disease. It takes hold on bushes already weakened by drought, hard pruning or poor nutrition, and turns whole leaves brown from the edge inward.",
    symptoms: [
      "Brown lesions with clear concentric rings, often ringed by a yellow band",
      "A pale grey to silvery centre on older lesions",
      "Damage starting at the leaf margin and spreading toward the midrib",
      "Worst on stressed, recently pruned or poorly fed bushes",
    ],
    treatments: [
      {
        title: "Treat the stress, not just the spots",
        detail:
          "Brown blight is a symptom of a weak bush. Sort out drought stress, drainage and nutrition or the fungus will keep coming back after every spray.",
      },
      {
        title: "Prune out and burn infected shoots",
        detail:
          "Cut back to healthy wood, then burn the material. Prunings left in the field keep re-infecting the new flush.",
      },
      {
        title: "Apply copper oxychloride",
        detail:
          "Spray to run-off across the affected block, repeating after 10 to 14 days in wet weather. Spray immediately after pruning, while the wounds are open.",
      },
      {
        title: "Rest the block from hard plucking",
        detail:
          "Ease off the plucking round until new growth is established. Each pluck is a fresh wound the fungus can enter.",
      },
    ],
    prevention: [
      "Apply potash-rich fertiliser on schedule, not only when symptoms show",
      "Mulch to hold soil moisture through the dry months",
      "Disinfect pruning tools between bushes in an affected block",
      "Spray a protectant fungicide straight after every pruning round",
    ],
  },
  {
    key: "gray blight",
    label: "Gray Blight",
    labelSi: "අළු අංගමාරය",
    pathogen: "Pestalotiopsis theae",
    severity: "high",
    summary:
      "The classic shear-harvest disease. It enters through plucking wounds, hail damage and insect bites, then spreads outward as a grey, papery dead patch dotted with black spore masses.",
    symptoms: [
      "Grey to silver-white dead patches with a sharp dark brown border",
      "Black pinhead fruiting dots arranged in rings on the grey area",
      "Lesions starting at a cut edge, tear or insect wound",
      "Dry, brittle tissue that crumbles when pressed",
    ],
    treatments: [
      {
        title: "Sterilise every cutting tool",
        detail:
          "This is the single most effective step. Disinfect shears, knives and mechanical harvesters between blocks, because gray blight travels on the blade.",
      },
      {
        title: "Spray straight after plucking or pruning",
        detail:
          "Apply a protectant fungicide such as copper oxychloride or carbendazim within a day of harvesting, while the wounds are still fresh and open.",
      },
      {
        title: "Collect and burn infected leaves",
        detail:
          "Rake up fallen diseased leaves as well as the ones still on the bush. The fungus survives on dead leaf litter between seasons.",
      },
      {
        title: "Ease up on shear harvesting",
        detail:
          "Switch the affected block to hand plucking for a round or two. Fewer ragged wounds means far fewer entry points.",
      },
    ],
    prevention: [
      "Keep blades sharp, since clean cuts heal faster than crushed ones",
      "Control shot-hole borer and other wound-making pests",
      "Maintain even shade so the canopy is not sun-scorched",
      "Avoid plucking while the foliage is still wet",
    ],
  },
  {
    key: "red leaf spot",
    label: "Red Leaf Spot",
    labelSi: "රතු පත්‍ර ලප",
    pathogen: "Phyllosticta theicola",
    severity: "moderate",
    summary:
      "A high-elevation and sun-exposure disease. It shows on mature leaves of hard-pruned or thinly shaded bushes, particularly where sun scorch has already damaged the tissue.",
    symptoms: [
      "Circular to irregular reddish-brown spots on mature leaves",
      "A darker red-purple margin around a slightly sunken centre",
      "Spots that merge into larger blotches on badly hit leaves",
      "Most common on the sun-exposed side of the bush",
    ],
    treatments: [
      {
        title: "Restore the shade",
        detail:
          "Red leaf spot follows sun scorch. Bring shade cover back up over exposed blocks, which fixes the underlying cause rather than the symptom.",
      },
      {
        title: "Mulch to hold soil moisture",
        detail:
          "Apply mulch along the rows so the bushes are not swinging between drought stress and heavy rain.",
      },
      {
        title: "Remove the worst leaves",
        detail:
          "Strip severely spotted mature leaves during the next round and destroy them away from the field.",
      },
      {
        title: "Spray if it keeps spreading",
        detail:
          "A copper-based fungicide will hold it, but only alongside the shade and moisture corrections above.",
      },
    ],
    prevention: [
      "Do not over-thin shade trees on exposed high-elevation blocks",
      "Keep a mulch layer through the dry season",
      "Feed with balanced fertiliser so recovery growth is strong",
      "Re-establish shade quickly after any hard pruning",
    ],
  },
  {
    key: "white spot",
    label: "White Spot",
    labelSi: "සුදු ලප",
    pathogen: "Phyllosticta / Cylindrocladium spp.",
    severity: "low",
    summary:
      "Mostly a nursery problem. Small bleached spots appear on young leaves kept in crowded, humid, low-light conditions, and heavy infection stunts the plant before it reaches the field.",
    symptoms: [
      "Small white to straw-coloured spots with a clean, sharply defined edge",
      "A thin brown ring around each spot on older lesions",
      "Concentrated on young leaves of nursery and newly planted stock",
      "Spreads quickly through crowded, poorly ventilated beds",
    ],
    treatments: [
      {
        title: "Open up the nursery",
        detail:
          "Increase ventilation and light in the beds and space the plants out. White spot collapses once the leaves stop staying wet all day.",
      },
      {
        title: "Change your watering time",
        detail:
          "Water in the morning so foliage dries before nightfall, and water at the base rather than over the top of the plants.",
      },
      {
        title: "Remove affected leaves",
        detail:
          "Strip spotted leaves from nursery plants and destroy them. Do not compost them next to the beds.",
      },
      {
        title: "Apply a protectant fungicide",
        detail:
          "A copper or mancozeb spray will stop the spread across the nursery if sanitation alone is not holding it.",
      },
    ],
    prevention: [
      "Never overcrowd nursery beds to save space",
      "Use clean potting medium and sterilised bags",
      "Inspect every batch before it moves out to the field",
      "Keep polythene covers vented so humidity does not build up",
    ],
  },
];

const UNKNOWN: DiseaseInfo = {
  key: "unknown",
  label: "Unrecognised Condition",
  labelSi: "හඳුනා නොගත් තත්ත්වය",
  pathogen: "Unknown",
  severity: "moderate",
  summary:
    "The model returned a label this app has no treatment guidance for. Show the leaf to your nearest agriculture instructor before treating it.",
  symptoms: [],
  treatments: [
    {
      title: "Get a second opinion",
      detail:
        "Take the affected leaf and shoot to the nearest TRI advisory officer or agriculture instructor before applying anything.",
    },
  ],
  prevention: [],
};

/** Lower-case, drop apostrophes, collapse whitespace, so "Bird's Eye Spot" matches "bird eye spot". */
function normalise(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['‘’`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_KEY = new Map<string, DiseaseInfo>();

for (const disease of DISEASES) {
  BY_KEY.set(normalise(disease.key), disease);
  BY_KEY.set(normalise(disease.label), disease);
}

/**
 * Raw model labels, plus spellings a future retrain might emit, that do not
 * match a key or label directly. "gray light" is the dataset's typo.
 */
const ALIASES: Record<string, string> = {
  "algal leaf": "algal leaf spot",
  "algal spot": "algal leaf spot",
  "birds eye spot": "bird eye spot",
  "gray light": "gray blight",
  "grey light": "gray blight",
  "grey blight": "gray blight",
  healthy: "healthy",
};

/** Resolve any raw model label to its treatment entry. Never throws. */
export function getDiseaseInfo(rawLabel: string): DiseaseInfo {
  const key = normalise(rawLabel ?? "");

  return BY_KEY.get(ALIASES[key] ?? key) ?? BY_KEY.get(key) ?? UNKNOWN;
}

/** Every supported condition, healthy first. Used for the idle-state grid. */
export const ALL_DISEASES: DiseaseInfo[] = DISEASES;

export function isHealthy(info: DiseaseInfo): boolean {
  return info.severity === "healthy";
}
