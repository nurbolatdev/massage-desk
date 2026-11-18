import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { msUntilNextMinute } from "./minuteTick";

// Current time that updates at every minute boundary and when the app returns to the foreground.
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      const current = new Date();
      setNow(current);
      timer = setTimeout(tick, msUntilNextMinute(current));
    };

    const start = () => {
      if (timer !== undefined) clearTimeout(timer);
      tick();
    };

    timer = setTimeout(tick, msUntilNextMinute(new Date()));

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
    });

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return now;
}
