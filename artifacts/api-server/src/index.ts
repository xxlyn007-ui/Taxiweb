import app from "./app";
const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT required");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error("Invalid PORT");
app.listen(port, () => console.log(`Server listening on port ${port}`));
