import { useQuery } from "@tanstack/react-query";
import { inventarioApi } from "../services/api";

export default function useStockActual(filtros = {}) {
  return useQuery({
    // La clave incluye los filtros para forzar el refetch si cambian
    queryKey: ['stockActual', filtros.almacen_id, filtros.categoria_id],
    queryFn: async () => {
      const data = await inventarioApi.getStockActual(filtros);
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de frescura en caché
  });
}