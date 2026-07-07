import { useQuery } from "@tanstack/react-query";
import axios from "axios"; // 1. Importación añadida

// Mantenemos tu lógica robusta intacta
function fillMissingDays(rawData, startDateStr, endDateStr) {
  const [sY, sM, sD] = startDateStr.split("-");
  const [eY, eM, eD] = endDateStr.split("-");
  let currDate = new Date(sY, sM - 1, sD);
  const endD = new Date(eY, eM - 1, eD);
  const filled = [];

  while (currDate <= endD) {
    const yyyy = currDate.getFullYear();
    const mm = String(currDate.getMonth() + 1).padStart(2, "0");
    const dd = String(currDate.getDate()).padStart(2, "0");
    const currStr = `${yyyy}-${mm}-${dd}`;
    const found = rawData.find((item) => item.fecha === currStr);
    filled.push({
      fecha: currStr,
      ventas_count: found ? parseInt(found.ventas_count, 10) : 0,
      revenue: found ? parseFloat(found.revenue) : 0,
      cost_real: found ? parseFloat(found.cost_real) : 0,
      profit: found ? parseFloat(found.profit) : 0,
      margin: found ? parseFloat(found.margin) : 0,
    });
    currDate.setDate(currDate.getDate() + 1);
  }
  return filled;
}

export default function useUtilidadPeriodo(desde, hasta) {
  return useQuery({
    queryKey: ["utilidadPeriodo", desde, hasta],

    queryFn: async ({ signal }) => {
      const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      // 2. Usamos axios directamente para evitar el error de apiClient
      // Antes tenías: `${BASE_URL}/api/v1/reportes/utilidad-periodo`
      // CÁMBIALO A ESTO:
      const response = await axios.get(`${BASE_URL}/reportes/utilidad-periodo`, {
        params: { desde, hasta },
        signal,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
         },
    });
      return response.data;
    },

    select: (payload) => {
      const filledPeriodo = fillMissingDays(payload.por_periodo || [], desde, hasta);
      return {
        ...payload,
        por_periodo: filledPeriodo,
      };
    },

    enabled: !!desde && !!hasta,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
    retry: 1,
  });
}