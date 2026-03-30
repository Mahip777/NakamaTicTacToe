import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export type AppAlertButton = {
  text: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "destructive";
};

export type ShowAppAlertOptions = {
  title: string;
  message?: string | ReactNode;
  buttons?: AppAlertButton[];
};

type Ctx = {
  showAlert: (opts: ShowAppAlertOptions) => void;
};

const AppAlertContext = createContext<Ctx | null>(null);

export function AppAlertProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<ShowAppAlertOptions | null>(null);

  const dismiss = useCallback(() => setOpen(null), []);

  const showAlert = useCallback((opts: ShowAppAlertOptions) => {
    const buttons =
      opts.buttons && opts.buttons.length > 0 ? opts.buttons : [{ text: "OK", variant: "primary" as const }];
    setOpen({ title: opts.title, message: opts.message, buttons });
  }, []);

  const value = useMemo(() => ({ showAlert }), [showAlert]);

  const onButtonPress = useCallback(
    (fn?: () => void) => {
      setOpen(null);
      requestAnimationFrame(() => fn?.());
    },
    []
  );

  return (
    <AppAlertContext.Provider value={value}>
      {children}
      <Modal visible={open != null} transparent animationType="fade" onRequestClose={dismiss}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            {open ? (
              <>
                <Text style={styles.title}>{open.title}</Text>
                {open.message != null && open.message !== "" ? (
                  <ScrollView
                    style={styles.messageScroll}
                    contentContainerStyle={styles.messageContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    {typeof open.message === "string" ? (
                      <Text style={styles.message}>{open.message}</Text>
                    ) : (
                      open.message
                    )}
                  </ScrollView>
                ) : null}
                <View
                  style={[
                    styles.btnRow,
                    (open.buttons?.length ?? 0) > 1 ? styles.btnRowMulti : styles.btnRowSingle
                  ]}
                >
                  {(open.buttons ?? [{ text: "OK" }]).map((b, i) => {
                    const multi = (open.buttons?.length ?? 0) > 1;
                    return (
                    <Pressable
                      key={`${b.text}-${i}`}
                      style={({ pressed }) => [
                        styles.alertBtn,
                        multi && styles.alertBtnInRow,
                        b.variant === "secondary" && styles.alertBtnSecondary,
                        b.variant === "destructive" && styles.alertBtnDestructive,
                        pressed && styles.alertBtnPressed
                      ]}
                      onPress={() => onButtonPress(b.onPress)}
                    >
                      <Text
                        style={[
                          styles.alertBtnText,
                          b.variant === "secondary" && styles.alertBtnTextSecondary,
                          b.variant === "destructive" && styles.alertBtnTextDestructive
                        ]}
                      >
                        {b.text}
                      </Text>
                    </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </AppAlertContext.Provider>
  );
}

export function useAppAlert(): Ctx {
  const ctx = useContext(AppAlertContext);
  if (!ctx) {
    throw new Error("useAppAlert must be used within AppAlertProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    padding: 24
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 20,
    paddingHorizontal: 20,
    maxHeight: "85%",
    shadowColor: "#0a0814",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 14
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    letterSpacing: 0.3
  },
  messageScroll: { maxHeight: 280 },
  messageContent: { paddingBottom: 4 },
  message: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  btnRow: {
    marginTop: 18,
    gap: 10
  },
  btnRowSingle: {
    flexDirection: "column",
    alignItems: "stretch"
  },
  btnRowMulti: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  alertBtn: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: colors.buttonPrimaryBg,
    borderWidth: 1,
    borderColor: colors.buttonPrimaryBorder,
    alignSelf: "stretch"
  },
  alertBtnInRow: {
    flexGrow: 1,
    flexBasis: "45%",
    minWidth: "42%",
    alignSelf: "auto"
  },
  alertBtnSecondary: {
    backgroundColor: "transparent",
    borderColor: colors.outlineMuted
  },
  alertBtnDestructive: {
    backgroundColor: colors.destructiveBg,
    borderColor: colors.destructiveBorder
  },
  alertBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }]
  },
  alertBtnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600"
  },
  alertBtnTextSecondary: {
    color: colors.accent,
    fontWeight: "500"
  },
  alertBtnTextDestructive: {
    color: colors.destructiveText,
    fontWeight: "600"
  }
});
