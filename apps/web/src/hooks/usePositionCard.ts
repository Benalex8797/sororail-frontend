import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Position } from "@/lib/positions";
import { NETWORK_PASSPHRASE, RPC_URL } from "@/lib/network";

interface ClientOptions {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
  publicKey?: string;
}

interface PositionClient {
  get(): Promise<unknown>;
}

export function usePositionCard<ClientType extends PositionClient>(
  ClientConstructor: new (opts: ClientOptions) => ClientType,
  position: Position,
  address: string | null,
  onRefresh?: (client: ClientType, isCurrent: () => boolean) => Promise<void>,
) {
  type DataType = Awaited<ReturnType<ClientType["get"]>>;
  const [data, setData] = useState<DataType | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeRequestIdRef = useRef(0);

  const client = useMemo(
    () =>
      new ClientConstructor({
        contractId: position.contractId,
        rpcUrl: RPC_URL,
        networkPassphrase: NETWORK_PASSPHRASE,
        ...(address ? { publicKey: address } : {}),
      }),
    [ClientConstructor, position.contractId, address],
  );

  const refresh = useCallback(async () => {
    if (!address) return;
    if (position.network && position.network !== RPC_URL) return;
    const requestId = ++activeRequestIdRef.current;
    const isCurrent = () => requestId === activeRequestIdRef.current;
    setIsLoading(true);
    try {
      setData((await client.get()) as Awaited<ReturnType<ClientType["get"]>>);
      setLoadError(null);
      if (onRefresh) {
        await onRefresh(client, isCurrent);
      }
    } catch (error) {
      if (!isCurrent()) return;
      setLoadError(error);
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [client, address, position.network, onRefresh]);

  useEffect(() => {
    void refresh();
    return () => {
      activeRequestIdRef.current += 1;
    };
  }, [refresh]);

  return { data, loadError, client, refresh, isLoading };
}
