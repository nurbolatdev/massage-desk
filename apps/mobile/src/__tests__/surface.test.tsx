import { describe, expect, it, jest } from "@jest/globals";
import { render, screen, userEvent } from "@testing-library/react-native";
import { Text } from "react-native";

import { PressableSurface, Surface } from "@/components/Surface";
import { colors, depth, radii } from "@/theme";

describe("Surface", () => {
  it("renders children with the surface background and level 1 depth", async () => {
    await render(
      <Surface testID="card" accessibilityLabel="Карточка" style={{ borderRadius: radii[16] }}>
        <Text>Внутри</Text>
      </Surface>,
    );
    expect(screen.getByText("Внутри")).toBeOnTheScreen();
    expect(screen.getByLabelText("Карточка")).toBeOnTheScreen();
    expect(screen.getByTestId("card")).toHaveStyle({
      backgroundColor: colors.surface,
      boxShadow: depth.level1.boxShadow,
      borderRadius: radii[16],
    });
  });

  it("uses the line colour for the shadow", () => {
    expect(depth.level1.boxShadow).toBe("0 1px 0 #E6DCCB");
  });
});

describe("PressableSurface", () => {
  it("is a button with the same look and calls onPress once", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <PressableSurface accessibilityRole="button" accessibilityLabel="Открыть" onPress={onPress}>
        <Text>Открыть</Text>
      </PressableSurface>,
    );
    const button = screen.getByRole("button", { name: "Открыть" });
    expect(button).toHaveStyle({ backgroundColor: colors.surface, boxShadow: depth.level1.boxShadow });
    await user.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
