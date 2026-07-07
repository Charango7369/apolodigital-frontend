import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export default function useUtilidadPorProducto(desde, hasta, orden = 'profit', limit = 10) {
  return useQuery({
    queryKey: ['utilidadProductos', desde, hasta, orden, limit],
    queryFn: async ({ signal }) => {
      const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      
      const response = await axios.get(
        `${BASE_URL}/reportes/utilidad-productos`, 
        {
           params: { desde, hasta, orden, limit },
           signal,
           headers: { 
             Authorization: `Bearer ${localStorage.getItem("token")}` 
           },
      }
    );
      return response.data;
    },
    enabled: !!desde && !!hasta,
    staleTime: 1000 * 60,
    retry: 1
  });
}