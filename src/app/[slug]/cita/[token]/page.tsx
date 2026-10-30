"use client";
import { use } from "react";
import { CitaPublic } from "@/components/CitaPublic";

export default function Cita({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = use(params);
  return <CitaPublic slug={slug} token={token} />;
}
