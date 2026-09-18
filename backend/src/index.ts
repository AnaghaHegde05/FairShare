import dotenv from "dotenv";
dotenv.config();

import { createApp } from "./app";

const PORT = process.env.PORT || 5000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`FairShare backend running on http://localhost:${PORT}`);
});
