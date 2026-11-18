import { Ionicons } from "@expo/vector-icons";
import { useState, type ComponentRef, type Ref } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { colors, radii, size, space, typography } from "@/theme";

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  revealable?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
  editable?: boolean;
} & Pick<
  TextInputProps,
  | "keyboardType"
  | "autoComplete"
  | "textContentType"
  | "autoCapitalize"
  | "returnKeyType"
  | "onSubmitEditing"
  | "submitBehavior"
>;

const ICON_SIZE = 22;

export function TextField({
  label,
  value,
  onChangeText,
  revealable = false,
  ref,
  editable = true,
  ...inputProps
}: Props) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused]}>
        <TextInput
          {...inputProps}
          ref={ref}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          secureTextEntry={revealable && !revealed}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />
        {revealable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Скрыть пароль" : "Показать пароль"}
            onPress={() => setRevealed((current) => !current)}
            style={styles.eye}
          >
            <Ionicons name={revealed ? "eye-off-outline" : "eye-outline"} size={ICON_SIZE} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space[6] },
  label: { ...typography.body, fontWeight: "700", color: colors.ink },
  box: {
    minHeight: size.field,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radii[16],
    backgroundColor: colors.surface,
    paddingLeft: space[16],
    paddingRight: space[6],
  },
  boxFocused: { borderColor: colors.primary },
  input: { ...typography.body, fontWeight: "600", color: colors.ink, flex: 1, minWidth: 0 },
  eye: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: radii[12],
    alignItems: "center",
    justifyContent: "center",
  },
});
