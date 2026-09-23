export const demoEnabled = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === "true";

export type DemoContext = {
  hour: string;
  location: string;
  device: "CORPORATIVO" | "PERSONAL";
};

let context: DemoContext = { hour: "10", location: "PERU", device: "CORPORATIVO" };

export function getDemoContext(): DemoContext { return context; }
export function setDemoContext(next: DemoContext): void { context = next; }

export function demoHeaders(): Record<string, string> {
  if (!demoEnabled) return {};
  return {
    "X-Demo-Hour": context.hour,
    "X-Demo-Location": context.location,
    "X-Demo-Device": context.device
  };
}
