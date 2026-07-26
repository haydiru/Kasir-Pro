"use client";

import { useEffect } from "react";
import { syncFlipEmailsFromGmail } from "@/app/actions/flip-gmail";

export function AutoFlipSync() {
  useEffect(() => {
    // Jalankan penarikan berkala secara hemat setiap 1 jam sekali (3.600.000 ms) di latar belakang
    const interval = setInterval(() => {
      syncFlipEmailsFromGmail().catch(() => {});
    }, 3600000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return null; // Komponen ini tidak menampilkan UI fisik (hanya background worker)
}
