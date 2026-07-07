import { useQuery } from "@tanstack/react-query";
import { inventarioApi } from "../services/api";

export default function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: () => inventarioApi.getCategorias(),
    staleTime: 1000 * 60 * 30,
  });
}