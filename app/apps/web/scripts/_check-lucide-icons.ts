/** Verify every lucide-react icon name planned for the industry map exists
 * in the installed version. Missing names would fail the Next build. */
import * as lucide from "lucide-react";

const names = [
  // tech
  "Cpu", "Code", "Globe", "ShieldCheck", "Network", "CircuitBoard", "RadioTower",
  "Wifi", "HardDrive", "Database", "Gamepad2", "Atom", "Smartphone",
  // health
  "Stethoscope", "Hospital", "Pill", "Dna", "Activity", "Brain", "Dumbbell",
  "Leaf", "PawPrint", "HeartPulse",
  // finance
  "Landmark", "Banknote", "TrendingUp", "Umbrella", "Sprout", "Calculator", "PiggyBank",
  // public
  "Flag", "Handshake", "ScrollText", "Lightbulb", "Vote", "Siren", "Gavel", "Shield",
  // nonprofit
  "HeartHandshake", "Users", "HandHeart", "Heart", "Baby", "Church", "Library",
  // education
  "GraduationCap", "School", "Backpack", "Laptop", "Presentation", "FlaskConical", "BookOpen",
  // services
  "Briefcase", "Megaphone", "MessageSquare", "PenTool", "Palette", "Scale",
  "UserCheck", "UserPlus", "ClipboardList", "Calendar", "Wrench", "Fingerprint",
  "Layers", "Languages",
  // manufacturing
  "Cog", "Plug", "Bot", "Car", "Rocket", "Satellite", "TestTube", "Scissors",
  "Armchair", "Package", "TreePine", "Printer", "Ship", "Box", "Boxes", "Factory", "Hammer",
  // energy
  "Fuel", "Zap", "Wind", "Recycle", "Pickaxe",
  // agrifood
  "Tractor", "Beef", "Milk", "Fish", "Wheat", "UtensilsCrossed", "Wine", "Cigarette",
  // transport
  "Truck", "Plane", "Anchor", "PackageCheck", "PackageSearch", "Warehouse", "Container",
  // construction / real estate
  "HardHat", "TrafficCone", "DraftingCompass", "BrickWall", "Building", "Building2", "KeyRound",
  // consumer
  "Store", "ShoppingBag", "ShoppingCart", "ConciergeBell", "Shirt", "Sparkles",
  "Gem", "Medal", "Brush", "Hotel", "ChefHat", "Luggage", "Bike", "Dices",
  // media
  "Newspaper", "Rss", "Clapperboard", "Film", "Music", "Drama", "Camera",
  "PartyPopper", "Trophy", "Feather",
];

const missing = names.filter((n) => !(n in lucide));
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
console.log(`checked=${names.length} missing=[${missing.join(", ")}] dupes-in-list=[${dupes.join(", ")}]`);
if (missing.length > 0) process.exit(1);
