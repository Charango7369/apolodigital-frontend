import { useQuery } from "@tanstack/react-query";
import { inventarioApi } from "../services/api"; // Usamos tu API configurada

export default function useAlertasStock(almacenId = null) {
  return useQuery({
    queryKey: ['alertasStock', almacenId],
    queryFn: async () => {
      // Reutilizamos el endpoint que ya sabemos que responde con 200 OK
      const data = await inventarioApi.getAlertasStock();
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de frescura
  });
}