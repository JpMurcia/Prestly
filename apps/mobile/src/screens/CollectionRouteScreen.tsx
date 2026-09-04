import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import type { CollectionRouteEntry } from '@repo/core';
import { Avatar, Badge, Card } from '@repo/ui/native';

import { useCollectionRoute } from '../hooks/useCollectionRoute';
import { RegisterPaymentModal } from '../components/RegisterPaymentModal';
import { formatMoney } from '../utils/money';

/** Mockup 2d — ruta de cobranza diaria: vencidas primero, luego las que vencen hoy (US2). */
export function CollectionRouteScreen() {
  const { data: entries, isLoading } = useCollectionRoute();
  const [selected, setSelected] = useState<CollectionRouteEntry | null>(null);

  // Saldo restante de cada cuota, no su monto original — una cuota `parcial` ya entregó
  // parte de lo esperado (specs/003-operational-management/, corrección por pagos parciales).
  const total = (entries ?? []).reduce(
    (acc, e) => acc + (e.installment.totalAmount - (e.installment.paidAmount ?? 0)),
    0
  );

  return (
    <View className="flex-1 bg-neutral-50 px-4 pt-4">
      <Text className="mb-3 text-2xl font-extrabold text-brand-ink">Ruta de hoy</Text>

      <Card className="mb-3 bg-brand-ink">
        <Text className="text-xs font-bold uppercase text-neutral-400">Cobro esperado hoy</Text>
        <Text testID="route-summary-total" className="text-3xl font-extrabold tabular-nums text-white">
          ${formatMoney(total)}
        </Text>
        <Text testID="route-summary-count" className="text-sm text-neutral-400">
          {entries?.length ?? 0} clientes
        </Text>
      </Card>

      {isLoading && <ActivityIndicator />}

      {!isLoading && (entries?.length ?? 0) === 0 && (
        <View testID="route-empty-state" className="items-center py-12">
          <Text className="text-lg font-bold text-brand-ink">¡Día libre!</Text>
          <Text className="text-sm text-neutral-500">No tenés cobros pendientes hoy.</Text>
        </View>
      )}

      <FlatList
        data={entries ?? []}
        keyExtractor={(item) => item.installment.id}
        renderItem={({ item }) => <RouteRow entry={item} onPress={() => setSelected(item)} />}
      />

      {selected && (
        <RegisterPaymentModal
          visible
          onClose={() => setSelected(null)}
          installmentId={selected.installment.id}
          remainingBalance={
            Math.round((selected.installment.totalAmount - (selected.installment.paidAmount ?? 0) + Number.EPSILON) * 100) / 100
          }
          subtitle={`Cuota ${selected.installment.number} de ${selected.installmentCount} · ${selected.client.name}`}
        />
      )}
    </View>
  );
}

function RouteRow({ entry, onPress }: { entry: CollectionRouteEntry; onPress: () => void }) {
  const isOverdue = entry.overdueDays > 0;
  return (
    <View
      testID={`route-row-${entry.installment.id}`}
      className={[
        'mb-2 flex-row items-center gap-2 rounded-lg border-l-4 bg-white p-3',
        isOverdue ? 'border-l-[#DC2626]' : 'border-l-[#F59E0B]',
      ].join(' ')}
    >
      <Avatar name={entry.client.name} />
      <View className="flex-1">
        <Text className="font-bold text-brand-ink">{entry.client.name}</Text>
        <Text className="text-xs text-neutral-500">
          cuota {entry.installment.number} de {entry.installmentCount}
        </Text>
        <Badge label={isOverdue ? `Mora ${entry.overdueDays} días` : 'Vence hoy'} tone={isOverdue ? 'mora' : 'cobroHoy'} />
      </View>
      <Text className="font-extrabold tabular-nums text-brand-ink">
        ${formatMoney(entry.installment.totalAmount - (entry.installment.paidAmount ?? 0))}
      </Text>
      <Pressable
        testID={`route-collect-${entry.installment.id}`}
        onPress={onPress}
        className="h-9 w-9 items-center justify-center rounded-full bg-brand-emerald"
      >
        <Text className="text-lg font-bold text-white">+</Text>
      </Pressable>
    </View>
  );
}
