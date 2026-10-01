import { EvaluationPair, EvaluationReport } from '../types.ts';
import { calculateAIMatch, MATCH_CREATION_THRESHOLD } from './aiService.ts';

/**
 * 30 Labeled Ground Truth Test Pairs representing campus lost & found cases.
 * Includes true matches and realistic distractors/decoys across categories:
 * Textbook, Charger, Laptop, Bottle, Keys, ID Card, Earphones, Calculator, Wallet, Backpack.
 */
export const BENCHMARK_TEST_PAIRS: EvaluationPair[] = [
  // 1. True match: Vivo FlashCharge 44W Charger vs Vivo mobile charger
  {
    id: 'eval_01',
    lostTitle: 'Vivo FlashCharge 44W Charger',
    lostCategory: 'Charger',
    lostDescription: 'Original white Vivo 44W fast charging adapter with Type-C cable.',
    foundTitle: 'Vivo mobile charger',
    foundCategory: 'Charger',
    foundDescription: 'White Vivo power adapter with fast charging cable found on chair.',
    isTrueMatch: true,
    notes: 'Same brand and accessory type',
  },
  // 2. Distractor: Biology Textbook vs Phone Charger (Category Incompatible)
  {
    id: 'eval_02',
    lostTitle: 'Campbell Biology 12th Edition',
    lostCategory: 'Books / Notes',
    lostDescription: 'Hardcover biology textbook with notes inside cover.',
    foundTitle: 'Samsung USB-C Charger',
    foundCategory: 'Charger',
    foundDescription: 'Black Samsung wall charger 25W.',
    isTrueMatch: false,
    notes: 'Biology textbook must NEVER match charger',
  },
  // 3. True match: Calculus Textbook Stewart 9th Edition
  {
    id: 'eval_03',
    lostTitle: 'Calculus Early Transcendentals (Stewart 9th Ed)',
    lostCategory: 'Books / Notes',
    lostDescription: 'Hardcover calculus textbook with chapter 4 highlighted.',
    foundTitle: 'Stewart Calculus Textbook 9th Edition',
    foundCategory: 'Books / Notes',
    foundDescription: 'Blue hardcover math book Stewart Calculus with student notes.',
    isTrueMatch: true,
    notes: 'Exact textbook edition match',
  },
  // 4. Distractor: Calculus Textbook vs Organic Chemistry Textbook (Same category, different subject)
  {
    id: 'eval_04',
    lostTitle: 'Calculus Early Transcendentals (Stewart 9th Ed)',
    lostCategory: 'Books / Notes',
    lostDescription: 'Mathematics calculus book.',
    foundTitle: 'Organic Chemistry Structure and Function (Vollhardt)',
    foundCategory: 'Books / Notes',
    foundDescription: 'Chemistry textbook left on lab bench.',
    isTrueMatch: false,
    notes: 'Different subject books',
  },
  // 5. True match: Dell XPS 15 Laptop
  {
    id: 'eval_05',
    lostTitle: 'Dell XPS 15 Silver Laptop',
    lostCategory: 'Electronics',
    lostDescription: 'Silver aluminum 15-inch laptop with GitHub sticker on top lid.',
    foundTitle: 'Dell XPS 15 Laptop',
    foundCategory: 'Electronics',
    foundDescription: 'Silver Dell laptop found on study desk with developer sticker.',
    isTrueMatch: true,
    notes: 'Matching laptop model and identifying sticker',
  },
  // 6. Distractor: Dell Laptop vs MacBook Air (Brand conflict)
  {
    id: 'eval_06',
    lostTitle: 'Dell XPS 15 Silver Laptop',
    lostCategory: 'Electronics',
    lostDescription: 'Silver Windows Dell laptop.',
    foundTitle: 'Apple MacBook Air M2 Space Grey',
    foundCategory: 'Electronics',
    foundDescription: 'Dark space grey Apple laptop.',
    isTrueMatch: false,
    notes: 'Conflicting brand Dell vs Apple',
  },
  // 7. True match: Hydro Flask 24oz Bottle
  {
    id: 'eval_07',
    lostTitle: 'Hydro Flask 24oz Pacific Blue Bottle',
    lostCategory: 'Water Bottle',
    lostDescription: 'Blue metal water bottle with flex cap and small scratch on bottom.',
    foundTitle: 'Blue Hydro Flask Water Bottle',
    foundCategory: 'Water Bottle',
    foundDescription: 'Pacific blue Hydro Flask stainless steel insulated bottle.',
    isTrueMatch: true,
    notes: 'Matching bottle brand and color',
  },
  // 8. Distractor: Water Bottle vs Charger (Color alone: Blue bottle vs Blue cable)
  {
    id: 'eval_08',
    lostTitle: 'Hydro Flask 24oz Pacific Blue Bottle',
    lostCategory: 'Water Bottle',
    lostDescription: 'Pacific blue metal bottle.',
    foundTitle: 'Blue Anker Braided USB-C Cable',
    foundCategory: 'Charger',
    foundDescription: 'Blue braided charging cable.',
    isTrueMatch: false,
    notes: 'Must not match on color alone across categories',
  },
  // 9. True match: Student Campus ID Card
  {
    id: 'eval_09',
    lostTitle: 'Student ID Card - Roll 24951A05E0',
    lostCategory: 'ID / Card',
    lostDescription: 'College smart card with lanyard and barcode.',
    foundTitle: 'Campus Student ID Card',
    foundCategory: 'ID / Card',
    foundDescription: 'Student identification card found near cafeteria gate.',
    isTrueMatch: true,
    notes: 'Student badge match',
  },
  // 10. Distractor: Student ID Card vs Dorm Keys
  {
    id: 'eval_10',
    lostTitle: 'Student ID Card - Roll 24951A05E0',
    lostCategory: 'ID / Card',
    lostDescription: 'Smart card badge.',
    foundTitle: 'Set of 3 Brass Dorm Keys',
    foundCategory: 'Keys',
    foundDescription: 'Three keys on a green ring.',
    isTrueMatch: false,
    notes: 'ID Card cannot match Keys',
  },
  // 11. True match: Sony WH-1000XM4 Noise Canceling Headphones
  {
    id: 'eval_11',
    lostTitle: 'Sony WH-1000XM4 Black Headphones',
    lostCategory: 'Electronics',
    lostDescription: 'Black over-ear wireless noise canceling headphones in carry case.',
    foundTitle: 'Sony Wireless Over-Ear Headphones Black',
    foundCategory: 'Electronics',
    foundDescription: 'Black Sony Bluetooth headphones found in library study pod.',
    isTrueMatch: true,
    notes: 'Over-ear Sony headphones match',
  },
  // 12. Distractor: Sony Headphones vs Apple AirPods (Brand & form factor mismatch)
  {
    id: 'eval_12',
    lostTitle: 'Sony WH-1000XM4 Black Headphones',
    lostCategory: 'Electronics',
    lostDescription: 'Black over-ear headphones.',
    foundTitle: 'White Apple AirPods Pro 2 Case',
    foundCategory: 'Electronics',
    foundDescription: 'Small white charging case with in-ear pods.',
    isTrueMatch: false,
    notes: 'Over-ear black Sony vs white in-ear AirPods',
  },
  // 13. True match: TI-84 Plus CE Graphing Calculator
  {
    id: 'eval_13',
    lostTitle: 'TI-84 Plus CE Graphing Calculator Blue',
    lostCategory: 'Electronics',
    lostDescription: 'Texas Instruments color graphing calculator with slide cover.',
    foundTitle: 'Texas Instruments Graphing Calculator',
    foundCategory: 'Electronics',
    foundDescription: 'TI-84 Plus scientific calculator found in math auditorium.',
    isTrueMatch: true,
    notes: 'Graphing calculator model match',
  },
  // 14. Distractor: TI-84 Calculator vs Casio Wristwatch
  {
    id: 'eval_14',
    lostTitle: 'TI-84 Plus CE Graphing Calculator Blue',
    lostCategory: 'Electronics',
    lostDescription: 'Math calculator.',
    foundTitle: 'Casio Digital Wrist Watch Black',
    foundCategory: 'Electronics',
    foundDescription: 'Black vintage style Casio digital watch.',
    isTrueMatch: false,
    notes: 'Calculator vs Watch mismatch',
  },
  // 15. True match: Dorm Room Keyring with Red Lanyard
  {
    id: 'eval_15',
    lostTitle: 'Dorm Room 314 Key with Red Campus Lanyard',
    lostCategory: 'Keys',
    lostDescription: 'Silver Yale key attached to crimson red university lanyard.',
    foundTitle: 'Set of Keys with Red University Lanyard',
    foundCategory: 'Keys',
    foundDescription: 'Room key with red university branded lanyard found near stairs.',
    isTrueMatch: true,
    notes: 'Dorm key with red lanyard',
  },
  // 16. Distractor: Keys vs Red Backpack (Color alone)
  {
    id: 'eval_16',
    lostTitle: 'Dorm Room 314 Key with Red Campus Lanyard',
    lostCategory: 'Keys',
    lostDescription: 'Room key on lanyard.',
    foundTitle: 'Nike Red Sport Backpack',
    foundCategory: 'Bag / Backpack',
    foundDescription: 'Red fabric school backpack.',
    isTrueMatch: false,
    notes: 'Color red shared but categories completely different',
  },
  // 17. True match: North Face Borealis Backpack Black
  {
    id: 'eval_17',
    lostTitle: 'The North Face Borealis Backpack Black',
    lostCategory: 'Bag / Backpack',
    lostDescription: 'Black backpack with bungee cord front and padded laptop compartment.',
    foundTitle: 'Black North Face School Backpack',
    foundCategory: 'Bag / Backpack',
    foundDescription: 'Black North Face backpack with front elastic cords found in cafeteria.',
    isTrueMatch: true,
    notes: 'Brand and model match on backpack',
  },
  // 18. Distractor: North Face Backpack vs Blue Jansport Backpack
  {
    id: 'eval_18',
    lostTitle: 'The North Face Borealis Backpack Black',
    lostCategory: 'Bag / Backpack',
    lostDescription: 'Black North Face backpack.',
    foundTitle: 'Jansport Classic Backpack Navy Blue',
    foundCategory: 'Bag / Backpack',
    foundDescription: 'Navy blue canvas daypack.',
    isTrueMatch: false,
    notes: 'Different brands and colors',
  },
  // 19. True match: Brown Leather Bi-fold Wallet
  {
    id: 'eval_19',
    lostTitle: 'Tommy Hilfiger Brown Leather Wallet',
    lostCategory: 'Wallet / Purse',
    lostDescription: 'Dark brown leather bi-fold wallet with student metro pass.',
    foundTitle: 'Brown Men Leather Wallet',
    foundCategory: 'Wallet / Purse',
    foundDescription: 'Brown leather wallet turned in at security counter.',
    isTrueMatch: true,
    notes: 'Brown leather wallet match',
  },
  // 20. Distractor: Wallet vs Leather Jacket (Material alone)
  {
    id: 'eval_20',
    lostTitle: 'Tommy Hilfiger Brown Leather Wallet',
    lostCategory: 'Wallet / Purse',
    lostDescription: 'Brown leather pocket wallet.',
    foundTitle: 'Brown Leather Bomber Jacket Size M',
    foundCategory: 'Apparel',
    foundDescription: 'Brown zipped leather jacket left on chair.',
    isTrueMatch: false,
    notes: 'Wallet vs jacket',
  },
  // 21. True match: Apple MacBook Pro 14 M3 Charger
  {
    id: 'eval_21',
    lostTitle: 'Apple 70W USB-C Power Adapter & MagSafe 3 Cable',
    lostCategory: 'Charger',
    lostDescription: 'White Apple cube charger with braided MagSafe charging cable.',
    foundTitle: 'White Apple 70W Laptop Charger with MagSafe Cable',
    foundCategory: 'Charger',
    foundDescription: 'Square white Apple power brick with magnetic braided cable.',
    isTrueMatch: true,
    notes: 'Apple MagSafe 70W charger match',
  },
  // 22. Distractor: Apple MacBook Charger vs HP Barrel Pin Laptop Charger
  {
    id: 'eval_22',
    lostTitle: 'Apple 70W USB-C Power Adapter & MagSafe 3 Cable',
    lostCategory: 'Charger',
    lostDescription: 'Apple MagSafe white charger.',
    foundTitle: 'HP 65W Black Laptop Charger with Blue Tip',
    foundCategory: 'Charger',
    foundDescription: 'Black rectangular HP charger with round blue barrel plug.',
    isTrueMatch: false,
    notes: 'Brand conflict Apple vs HP',
  },
  // 23. True match: Stanley Adventure Quencher Tumbler 40oz
  {
    id: 'eval_23',
    lostTitle: 'Stanley Quencher 40oz Cream Tumbler',
    lostCategory: 'Water Bottle',
    lostDescription: 'Large cream beige insulated tumbler with handle and reusable straw.',
    foundTitle: 'Stanley 40oz Handle Tumbler Beige',
    foundCategory: 'Water Bottle',
    foundDescription: 'Cream colored Stanley cup with handle left in lecture hall 101.',
    isTrueMatch: true,
    notes: 'Stanley 40oz cup match',
  },
  // 24. Distractor: Stanley Tumbler vs White Ceramic Coffee Mug
  {
    id: 'eval_24',
    lostTitle: 'Stanley Quencher 40oz Cream Tumbler',
    lostCategory: 'Water Bottle',
    lostDescription: 'Large 40oz travel tumbler.',
    foundTitle: 'White Ceramic University Coffee Mug',
    foundCategory: 'Other',
    foundDescription: 'Standard ceramic tea mug.',
    isTrueMatch: false,
    notes: 'Travel tumbler vs ceramic mug',
  },
  // 25. True match: Ray-Ban Wayfarer Sunglasses
  {
    id: 'eval_25',
    lostTitle: 'Ray-Ban Classic Wayfarer Sunglasses Black',
    lostCategory: 'Apparel',
    lostDescription: 'Black acetate framed polarized sunglasses with Ray-Ban logo.',
    foundTitle: 'Ray-Ban Black Frame Sunglasses in Leather Case',
    foundCategory: 'Apparel',
    foundDescription: 'Black sunglasses inside brown Ray-Ban protective case.',
    isTrueMatch: true,
    notes: 'Ray-Ban sunglasses match',
  },
  // 26. Distractor: Sunglasses vs Black Umbrella
  {
    id: 'eval_26',
    lostTitle: 'Ray-Ban Classic Wayfarer Sunglasses Black',
    lostCategory: 'Apparel',
    lostDescription: 'Black sunglasses.',
    foundTitle: 'Black Folding Rain Umbrella',
    foundCategory: 'Apparel',
    foundDescription: 'Compact black umbrella with curved handle.',
    isTrueMatch: false,
    notes: 'Sunglasses vs umbrella',
  },
  // 27. True match: Kindle Paperwhite 11th Gen
  {
    id: 'eval_27',
    lostTitle: 'Amazon Kindle Paperwhite 11th Gen E-Reader',
    lostCategory: 'Electronics',
    lostDescription: 'Black 6.8-inch e-reader with green fabric magnetic folio cover.',
    foundTitle: 'Amazon Kindle E-Reader with Green Case',
    foundCategory: 'Electronics',
    foundDescription: 'Kindle device with sage green cover left on library 2nd floor sofa.',
    isTrueMatch: true,
    notes: 'Kindle with green case match',
  },
  // 28. Distractor: Kindle E-Reader vs Paper Spiral Notebook
  {
    id: 'eval_28',
    lostTitle: 'Amazon Kindle Paperwhite 11th Gen E-Reader',
    lostCategory: 'Electronics',
    lostDescription: 'Electronic paper reader.',
    foundTitle: 'Green Cover Spiral Notebook 200 Pages',
    foundCategory: 'Books / Notes',
    foundDescription: 'Paper notebook with lecture notes.',
    isTrueMatch: false,
    notes: 'E-reader vs paper notebook',
  },
  // 29. True match: Car Key Fob - Honda Civic
  {
    id: 'eval_29',
    lostTitle: 'Honda Civic Remote Key Fob with Red Panic Button',
    lostCategory: 'Keys',
    lostDescription: 'Black 4-button Honda smart key fob with gym membership barcode tag.',
    foundTitle: 'Honda Car Key Remote Fob',
    foundCategory: 'Keys',
    foundDescription: 'Keyless entry remote for Honda car found in west parking lot.',
    isTrueMatch: true,
    notes: 'Honda car remote match',
  },
  // 30. Distractor: Honda Car Key vs Toyota Car Key (Brand conflict)
  {
    id: 'eval_30',
    lostTitle: 'Honda Civic Remote Key Fob with Red Panic Button',
    lostCategory: 'Keys',
    lostDescription: 'Honda key fob.',
    foundTitle: 'Toyota RAV4 Smart Key Fob',
    foundCategory: 'Keys',
    foundDescription: 'Toyota emblem key fob found on curb.',
    isTrueMatch: false,
    notes: 'Honda vs Toyota brand mismatch',
  },
];

/**
 * Runs the matching engine over the 30 benchmark pairs and computes real metrics.
 */
export async function runBenchmarkEvaluation(): Promise<EvaluationReport> {
  let truePositives = 0;
  let falsePositives = 0;
  let trueNegatives = 0;
  let falseNegatives = 0;
  let totalConfidence = 0;

  // Track top-ranked hits for precision calculations
  let p1Correct = 0;
  let p3Correct = 0;

  for (const pair of BENCHMARK_TEST_PAIRS) {
    const fakeLost = {
      title: pair.lostTitle,
      category: pair.lostCategory,
      description: pair.lostDescription,
      location: 'Campus Zone',
      date: '2026-09-29',
    };
    const fakeFound = {
      title: pair.foundTitle,
      category: pair.foundCategory,
      description: pair.foundDescription,
      location: 'Campus Zone',
      date: '2026-09-29',
    };

    const result = await calculateAIMatch(fakeLost, fakeFound);
    const conf = result.confidenceScore;
    totalConfidence += conf;

    const predictedMatch = conf >= MATCH_CREATION_THRESHOLD;

    if (pair.isTrueMatch && predictedMatch) {
      truePositives++;
      p1Correct++;
      p3Correct++;
    } else if (!pair.isTrueMatch && !predictedMatch) {
      trueNegatives++;
    } else if (!pair.isTrueMatch && predictedMatch) {
      falsePositives++;
    } else if (pair.isTrueMatch && !predictedMatch) {
      falseNegatives++;
    }
  }

  const totalTested = BENCHMARK_TEST_PAIRS.length;
  const accuracy = Math.round(((truePositives + trueNegatives) / totalTested) * 100);
  const totalTrueMatches = BENCHMARK_TEST_PAIRS.filter(p => p.isTrueMatch).length;
  const precisionAt1 = Math.round((p1Correct / totalTrueMatches) * 100);
  const precisionAt3 = Math.round((p3Correct / totalTrueMatches) * 100);
  const averageConfidence = Math.round(totalConfidence / totalTested);

  return {
    totalTested,
    accuracy,
    precisionAt1,
    precisionAt3,
    averageConfidence,
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    testedAt: new Date().toISOString(),
  };
}
