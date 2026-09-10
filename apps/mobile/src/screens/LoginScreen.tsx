import { InvalidCredentialsError } from '@repo/core';
import { Button, Card } from '@repo/ui/native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { authRepository } from '../data/repositories';

/**
 * Login de la app de campo (specs/007-admin-authentication/, US2). Sin flujo de registro
 * (FR-006). Al loguearse con éxito, la sesión llega por `AuthProvider` (`onSessionChange`) y
 * `RootNavigator` monta el árbol de tabs solo — esta pantalla no navega manualmente.
 */
export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await authRepository.signInWithPassword(email, password);
    } catch (err) {
      setError(
        err instanceof InvalidCredentialsError
          ? 'Usuario o contraseña incorrectos.'
          : 'No se pudo conectar. Revisá tu conexión a internet e intentá de nuevo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 items-center justify-center bg-neutral-50 px-6"
    >
      <View className="mb-6 flex-row items-center gap-2.5">
        <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-brand-emerald">
          <Text className="font-display text-base font-extrabold text-brand-ink">P</Text>
        </View>
        <Text className="font-display text-lg font-extrabold tracking-tight text-brand-ink">Prestly</Text>
      </View>

      <Card className="w-full gap-4">
        <View>
          <Text className="font-display text-base font-bold text-brand-ink">Iniciar sesión</Text>
          <Text className="mt-0.5 text-xs font-medium text-neutral-400">Acceso exclusivo del cobrador/administrador</Text>
        </View>

        <View className="gap-3">
          <View className="gap-1">
            <Text className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Email</Text>
            <TextInput
              testID="login-email"
              autoCapitalize="none"
              autoComplete="username"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-brand-ink"
            />
          </View>

          <View className="gap-1">
            <Text className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Contraseña</Text>
            <TextInput
              testID="login-password"
              secureTextEntry
              autoComplete="current-password"
              value={password}
              onChangeText={setPassword}
              className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-brand-ink"
            />
          </View>

          {error ? <Text className="text-xs font-medium text-red-500">{error}</Text> : null}

          <Button label="Iniciar sesión" onPress={handleSubmit} loading={isSubmitting} className="mt-1" testID="login-submit" />
        </View>
      </Card>
    </KeyboardAvoidingView>
  );
}
