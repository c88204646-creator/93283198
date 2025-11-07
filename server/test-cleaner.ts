import { TextCleaner } from "./text-cleaner";

// Casos de prueba
const testCases = [
  "Buen Alexis Nos ayudas con la cuenta de gastos por favor Este contenedor no generó demoras según correo de la naviera:",
  "Buen dia Alexis Nos ayudas con el EIR de vacio",
  "Buen dia Yohali ya solicite al AA la informacion en cuanto la tenga te la comparto",
  "Buenos días, Nos complace informarte que el zarpe de tu embarque"
];

console.log("🧪 Probando TextCleaner...\n");

for (const test of testCases) {
  console.log("📝 Texto original:");
  console.log(`   "${test}"`);
  console.log("\n✅ Texto limpio:");
  const cleaned = TextCleaner.cleanNoteContent(test);
  console.log(`   "${cleaned}"`);
  console.log("\n" + "=".repeat(80) + "\n");
}
