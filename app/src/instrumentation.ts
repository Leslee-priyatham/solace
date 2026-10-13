// Starts background jobs (reminders, assistant routines) once per server process, and resumes any
// session whose processing was cut off by the previous process exiting.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const bootedAt = new Date();
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
    const { resumeInterruptedSessions } = await import("./lib/sessions");
    void resumeInterruptedSessions(bootedAt).catch((e) => console.error("[sessions] resume failed", e));
  }
}
