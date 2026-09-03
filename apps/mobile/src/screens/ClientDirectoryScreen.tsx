import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Client, PortfolioStatus } from '@repo/core';
import { Avatar, Badge, Button, Chip, ProgressBar } from '@repo/ui/native';

import { useClientDirectory } from '../hooks/useClientDirectory';
import { RegisterPaymentModal } from '../components/RegisterPaymentModal';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { formatMoney } from '../utils/money';

type FilterKey = 'todos' | PortfolioStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'cobro_hoy', label: 'Cobro hoy' },
  { key: 'al_dia', label: 'Al día' },
  { key: 'mora', label: 'Mora' },
];

const STATUS_BADGE: Record<PortfolioStatus, { label: string; tone: 'alDia' | 'cobroHoy' | 'mora' | 'neutral' }> = {
  al_dia: { label: 'Al día', tone: 'alDia' },
  cobro_hoy: { label: 'Cobra hoy', tone: 'cobroHoy' },
  mora: { label: 'Mora', tone: 'mora' },
  sin_prestamo_activo: { label: 'Sin préstamo activo', tone: 'neutral' },
};

/** Mockup 2b — directorio y cartera de clientes (US3). */
export function ClientDirectoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('todos');
  const [collecting, setCollecting] = useState<Client | null>(null);
  const { data: clients, isLoading } = useClientDirectory({ search: search || undefined });

  const counts = useMemo(() => {
    const base: Record<FilterKey, number> = { todos: 0, cobro_hoy: 0, al_dia: 0, mora: 0, sin_prestamo_activo: 0 };
    for (const client of clients ?? []) {
      base.todos += 1;
      const status = client.portfolio?.status ?? 'sin_prestamo_activo';
      base[status] = (base[status] ?? 0) + 1;
    }
    return base;
  }, [clients]);

  const filtered = useMemo(() => {
    if (filter === 'todos') return clients ?? [];
    return (clients ?? []).filter((c) => c.portfolio?.status === filter);
  }, [clients, filter]);

  return (
    <View className="flex-1 bg-neutral-50 px-4 pt-4">
      <Text className="mb-3 text-2xl font-extrabold text-brand-ink">Directorio</Text>

      <TextInput
        testID="directory-search-input"
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por nombre o teléfono"
        className="mb-3 rounded-lg border border-neutral-200 bg-white px-3 py-2"
      />

      <View className="mb-3 flex-row flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            testID={`directory-filter-${f.key}`}
            label={`${f.label} · ${counts[f.key]}`}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </View>

      {isLoading && <ActivityIndicator />}

      {!isLoading && filtered.length === 0 && (
        <View testID="directory-empty-state" className="items-center py-12">
          <Text className="text-lg font-bold text-brand-ink">Sin resultados</Text>
          <Text className="text-sm text-neutral-500">No encontramos clientes que coincidan.</Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ClientCard
            client={item}
            onPress={() => navigation.navigate('Perfil', { clientId: item.id })}
            onCollect={() => setCollecting(item)}
          />
        )}
      />

      {collecting?.portfolio?.nextInstallmentId && (
        <RegisterPaymentModal
          visible
          onClose={() => setCollecting(null)}
          installmentId={collecting.portfolio.nextInstallmentId}
          installmentAmount={collecting.portfolio.nextInstallmentAmount ?? 0}
          subtitle={collecting.name}
        />
      )}
    </View>
  );
}

function ClientCard({ client, onPress, onCollect }: { client: Client; onPress: () => void; onCollect: () => void }) {
  const portfolio = client.portfolio;
  const status = portfolio?.status ?? 'sin_prestamo_activo';
  const badge = STATUS_BADGE[status];
  const progress = portfolio && portfolio.installmentsTotal > 0 ? portfolio.installmentsPaid / portfolio.installmentsTotal : 0;

  return (
    <View testID={`directory-client-${client.id}`} className="mb-2 rounded-lg border border-neutral-200 bg-white p-3">
      <View className="flex-row items-center gap-2">
        <Avatar name={client.name} />
        <View className="flex-1">
          <Text className="font-bold text-brand-ink">{client.name}</Text>
          <Badge label={badge.label} tone={badge.tone} />
        </View>
        {portfolio && portfolio.status !== 'sin_prestamo_activo' && (
          <Text className="font-extrabold tabular-nums text-brand-ink">${formatMoney(portfolio.balance)}</Text>
        )}
      </View>
      {portfolio && portfolio.status !== 'sin_prestamo_activo' && (
        <View className="mt-2">
          <ProgressBar value={progress} />
          <Text className="mt-1 text-xs text-neutral-500">
            {portfolio.installmentsPaid} de {portfolio.installmentsTotal} cuotas
          </Text>
        </View>
      )}
      <View className="mt-2 flex-row gap-2">
        {(status === 'cobro_hoy' || status === 'mora') && portfolio?.nextInstallmentId && (
          <Button
            testID={`directory-collect-${client.id}`}
            label={`Cobrar $${formatMoney(portfolio.nextInstallmentAmount ?? 0)}`}
            onPress={onCollect}
            className="flex-1"
          />
        )}
        <Button
          testID={`directory-view-${client.id}`}
          label="Ver detalle"
          variant="secondary"
          onPress={onPress}
          className="flex-1"
        />
      </View>
    </View>
  );
}
