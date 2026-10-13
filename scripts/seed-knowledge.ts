import { seedKnowledge } from "@/server/knowledge";
import { knowledgeVector } from "@/server/vector";

const count = await seedKnowledge(knowledgeVector);
console.log(`Embedded ${count} runbooks and prior incidents into pgvector index "knowledge".`);
await knowledgeVector.disconnect();
