// Valores dummy para que supabaseClient.ts pueda inicializarse en tests unitarios/de
// componentes — ningún test de este proyecto debe pegarle a una red real (ver mocks).
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
