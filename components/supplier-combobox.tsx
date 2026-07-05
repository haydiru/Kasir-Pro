"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Check } from "lucide-react";
import { toast } from "sonner";

interface Supplier {
  id: string;
  kode: string;
  nama: string;
}

interface Props {
  selectedId: string;
  selectedName: string;
  onChange: (id: string, name: string) => void;
}

export default function SupplierCombobox({ selectedId, selectedName, onChange }: Props) {
  const [inputValue, setInputValue] = useState(selectedName || "");
  const [suggestions, setSuggestions] = useState<Supplier[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Simple inline debounce
  useEffect(() => {
    if (inputValue.trim() === "") {
      setSuggestions([]);
      return;
    }

    // Skip fetching if the user input matches the currently selected supplier name exactly
    if (inputValue === selectedName) {
      return;
    }

    const delayDebounce = setTimeout(() => {
      const fetchSuppliers = async () => {
        setIsLoading(true);
        try {
          const res = await fetch(`/api/suppliers?q=${encodeURIComponent(inputValue)}`);
          if (res.ok) {
            const data = await res.json();
            setSuggestions(data);
          }
        } catch (error) {
          console.error("Failed to fetch autocomplete suggestions", error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchSuppliers();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [inputValue, selectedName]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset input value to selectedName if they clicked away without choosing
        if (selectedName) {
          setInputValue(selectedName);
        } else {
          setInputValue("");
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedName]);

  const handleSelect = (supplier: Supplier) => {
    onChange(supplier.id, supplier.nama);
    setInputValue(supplier.nama);
    setIsOpen(false);
  };

  const handleCreateNew = async () => {
    if (!inputValue.trim()) return;

    setIsCreating(true);
    // Generate unique code automatically (e.g. SUPP-NAMA-1234)
    const cleanName = inputValue.trim().replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedCode = `SUPP-${cleanName}-${randomSuffix}`;

    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode: generatedCode,
          nama: inputValue.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Gagal membuat supplier baru");
      } else {
        toast.success(`Supplier "${data.nama}" berhasil ditambahkan otomatis!`);
        onChange(data.id, data.nama);
        setInputValue(data.nama);
        setIsOpen(false);
      }
    } catch (err) {
      console.error("Failed to create auto supplier:", err);
      toast.error("Terjadi kesalahan koneksi");
    } finally {
      setIsCreating(false);
    }
  };

  // Check if exactly match is present
  const exactMatchExists = suggestions.some(
    (s) => s.nama.toLowerCase() === inputValue.trim().toLowerCase()
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder="Ketik nama atau kode supplier..."
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            if (e.target.value === "") {
              onChange("", "");
            }
          }}
          onFocus={() => setIsOpen(true)}
          className="h-10 rounded-xl bg-muted/30 pr-10"
        />
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {isOpen && (inputValue.trim() !== "" || suggestions.length > 0) && (
        <div className="absolute z-50 w-full mt-1.5 bg-card border border-border/80 rounded-xl shadow-xl max-h-60 overflow-y-auto backdrop-blur-md">
          <ul className="p-1.5 space-y-0.5">
            {suggestions.map((supplier) => (
              <li
                key={supplier.id}
                onClick={() => handleSelect(supplier)}
                className="flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-accent hover:text-accent-foreground font-semibold transition"
              >
                <span>
                  {supplier.nama}{" "}
                  <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded ml-1.5">
                    {supplier.kode}
                  </span>
                </span>
                {selectedId === supplier.id && <Check className="h-4 w-4 text-primary" />}
              </li>
            ))}

            {inputValue.trim() !== "" && !exactMatchExists && (
              <li
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg cursor-pointer transition border border-dashed border-primary/20 mt-1"
              >
                {isCreating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>Tambah "{inputValue.trim()}" Sebagai Supplier Baru</span>
              </li>
            )}
            
            {suggestions.length === 0 && !isCreating && exactMatchExists && (
              <li className="px-3 py-2 text-xs text-muted-foreground text-center">
                Mencari...
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
