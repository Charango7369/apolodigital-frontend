import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, PackageX } from 'lucide-react';

function BuscadorProductosAsync({ selectedProduct, onChange }) {
  const [query, setQuery] = useState(selectedProduct?.nombre || '');
  const [productosBuscados, setProductosBuscados] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Sincronizar el input si el padre cambia el producto externamente
  useEffect(() => {
    if (selectedProduct?.nombre && selectedProduct.nombre !== query) {
      setQuery(selectedProduct.nombre);
    }
  }, [selectedProduct]);

  // Cerrar dropdown si se hace clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Petición HTTP
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const token = localStorage.getItem('token');
          const API_URL = import.meta.env.VITE_API_URL || 'https://apolodigital-inventario-production.up.railway.app/api/v1';
          
          const response = await fetch(
            `${API_URL}/productos?busqueda=${encodeURIComponent(query.trim())}&solo_activos=true&per_page=20`,
            {
              headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` })
              }
            }
          );

          if (!response.ok) throw new Error('Error en la petición');
          
          const data = await response.json();
          const listaProductos = data?.items || [];
          
          setProductosBuscados(listaProductos);
          setIsOpen(true);
        } catch (error) {
          console.error('Error buscando productos:', error);
          setProductosBuscados([]);
          setIsOpen(true);
        } finally {
          setIsLoading(false);
        }
      }, 300);
    } else {
      setProductosBuscados([]);
      setIsOpen(false);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ✅ AQUÍ ESTÁ LA CLAVE: Pasamos el objeto completo, no solo el ID
  const handleSelect = (producto) => {
    setQuery(producto.nombre);
    setIsOpen(false);
    onChange(producto); 
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Producto *</label>
      <div className="relative w-full" ref={wrapperRef}>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto (mín. 2 caracteres)..."
            className="input !pr-10"
            autoComplete="off"
          />
          {isLoading ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 animate-spin pointer-events-none" />
          ) : (
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          )}
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {isLoading && (
              <div className="p-3 text-sm text-gray-500 text-center flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
              </div>
            )}

            {!isLoading && productosBuscados.length === 0 && query.trim().length >= 2 && (
              <div className="p-3 text-sm text-gray-500 text-center flex items-center justify-center gap-2">
                <PackageX className="h-4 w-4" /> No se encontraron productos.
              </div>
            )}

            {!isLoading && productosBuscados.length > 0 && (
              <ul className="py-1">
                {productosBuscados.map((prod) => (
                  <li
                    key={prod.id}
                    onClick={() => handleSelect(prod)}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer flex justify-between items-center"
                  >
                    <span className="font-medium truncate">{prod.nombre}</span>
                    {prod.sku && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded ml-2 whitespace-nowrap">
                        {prod.sku}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default BuscadorProductosAsync;