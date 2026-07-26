"use client";

import { useEffect } from "react";
import { syncFlipEmailsFromGmail } from "@/app/actions/flip-gmail";

export function AutoFlipSync() {
  useEffect(() => {
    // Jalankan penarikan pertama kali 3 detik setelah aplikasi dimuat secara senyap
    const initialTimer = setTimeout(() => {
      syncFlipEmailsFromGmail().catch(() => {});
    }, 3000);

    // Jalankan penarikan berkala setiap 60 detik (1 menit) secara otomatis di latar belakang
    const interval = setInterval(() => {
      syncFlipEmailsFromGmail().catch(() => {});
    }, 60000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  return null; // Komponen ini tidak menampilkan UI fisik (hanya background worker)
}
