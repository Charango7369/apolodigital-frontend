import { useQuery } from "@tanstack/react-query";
import { inventarioApi } from "../services/api";

export default function useAlmacenes() {
  return useQuery({
    queryKey: ['almacenes'],
    queryFn: () => inventarioApi.getAlmacenes(),
    staleTime: 1000 * 60 * 30, // 30 minutos, ya que los almacenes no cambian a cada rato
  });
}