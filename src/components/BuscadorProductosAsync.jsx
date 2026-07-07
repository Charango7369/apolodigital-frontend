import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';

function BuscadorProductosAsync({ selectedProduct, onChange, onProductosBuscados }) {
  const [query, setQuery] = useState(selectedProduct?.nombre || '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [productosBuscados, setProductosBuscados] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const wrapperRef = useRef(null);
  const abortRef = useRef(null);
  const onProductosBuscadosRef = useRef(onProductosBuscados);

  useEffect(() => {
    onProductosBuscadosRef.current = onProductosBuscados;
  }, [onProductosBuscados]);

  useEffect(() => {
    if (selectedProduct?.nombre && selectedProduct.nombre !== query) {
      setQuery(selectedProduct.nombre);
    } else if (!selectedProduct) {
      setQuery('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const texto = debouncedQuery;

    if (texto.length < 2) {
      setProductosBuscados([]);
      setIsOpen(false);
      setIsLoading(false);
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const buscar = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const API_URL = import.meta.env.VITE_API_URL;
        const response = await fetch(
          `${API_URL}/productos?busqueda=${encodeURIComponent(texto)}&solo_activos=true&per_page=20`,
          {
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          }
        );

        if (!response.ok) throw new Error('Error en la petición');

        const data = await response.json();
        let listaProductos = [];
        if (Array.isArray(data) && Array.isArray(data[0])) {
          listaProductos = data[0];
        } else {
          listaProductos = data?.items || data || [];
        }

        setProductosBuscados(listaProductos);

        const inputActivo = wrapperRef.current?.querySelector('input');
        if (document.activeElement === inputActivo) {
          setIsOpen(listaProductos.length > 0);
        }

        if (onProductosBuscadosRef.current && listaProductos.length > 0) {
          onProductosBuscadosRef.current(listaProductos);
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Error buscando productos:', error);
        setProductosBuscados([]);
        setIsOpen(false);
      } finally {
        if (abortRef.current === controller) {
          setIsLoading(false);
          abortRef.current = null;
        }
      }
    };

    buscar();
    return () => controller.abort();
  }, [debouncedQuery]);

  const handleSelect = useCallback(
    (producto) => {
      setQuery(producto.nombre);
      setIsOpen(false);
      onChange(producto);
    },
    [onChange]
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Producto *</label>
      <div className="relative w-full" ref={wrapperRef}>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (productosBuscados.length > 0) {
                setIsOpen(true);
              }
            }}
            className="input !pr-10 w-full px-3 py-2 border rounded-md"
            autoComplete="off"
            placeholder="Buscar por nombre o código..."
          />
          {isLoading ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 animate-spin pointer-events-none" />
          ) : (
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          )}
        </div>

        {isOpen && productosBuscados.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            <ul className="py-1">
              {productosBuscados.map((prod) => (
                <li
                  key={prod.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(prod);
                  }}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer flex justify-between items-center"
                >
                  <span className="font-medium truncate">{prod.nombre}</span>
                  {prod.codigo_barras && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded ml-2 whitespace-nowrap">
                      {prod.codigo_barras}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default BuscadorProductosAsync;
