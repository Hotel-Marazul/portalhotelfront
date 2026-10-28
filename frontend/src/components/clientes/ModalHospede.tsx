"use client";

import React, { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import apiClient from "../../services/api";
import { apiErrorMessage } from "../../utils/api-error";
import Button from "../ui/Button";
import Sheet from "../ui/Sheet";
import { toast } from "../ui/Toast";
import ClientFields from "../nova-reserva/ClientFields";
import {
  clientPayload,
  emptyClientForm,
  validateClientForm,
  type ClientFormData,
  type ClientFormErrors,
} from "../nova-reserva/nova-reserva-data";

export interface HospedeInitialValues {
  fullName?: string;
  cpf?: string;
  email?: string;
  fone?: string;
  automovel?: string;
  placa?: string;
}

export interface HospedeSuccessClient {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
  fone: string;
}

interface ModalAdicionarHospedeProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (client?: HospedeSuccessClient) => void;
  mode: "adicionar" | "editar" | "excluir";
  hospedeId?: string;
  initialValues?: HospedeInitialValues;
}

export default function ModaAdicionarlHospede({
  open,
  onClose,
  onSuccess,
  mode,
  hospedeId,
  initialValues,
}: ModalAdicionarHospedeProps) {
  const formId = useId();
  const [formData, setFormData] = useState<ClientFormData>(emptyClientForm);
  const [errors, setErrors] = useState<ClientFormErrors>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const formMode = mode === "editar" ? "editar" : "adicionar";

  // Carrega o cadastro ao editar; ao adicionar, parte dos valores iniciais.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setLoadError(null);
    if (mode === "editar" && hospedeId) {
      let cancelled = false;
      setFormData(emptyClientForm);
      setLoading(true);
      apiClient.get(`/api/client/${hospedeId}`)
        .then(({ data }) => {
          if (cancelled) return;
          setFormData({
            fullName: data.fullName || "",
            cpf: data.cpf || "",
            email: data.email || "",
            fone: data.fone || "",
            automovel: data.automovel || "",
            placa: data.placa || "",
          });
        })
        .catch((error) => {
          if (!cancelled) setLoadError(apiErrorMessage(error, "Erro ao carregar dados do hóspede."));
        })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
    if (mode === "adicionar") {
      setFormData({
        fullName: initialValues?.fullName ?? "",
        cpf: initialValues?.cpf ?? "",
        email: initialValues?.email ?? "",
        fone: initialValues?.fone ?? "",
        automovel: initialValues?.automovel ?? "",
        placa: initialValues?.placa ?? "",
      });
    }
  }, [open, mode, hospedeId, initialValues?.fullName, initialValues?.cpf, initialValues?.email, initialValues?.fone, initialValues?.automovel, initialValues?.placa]);

  const handleChange = (field: keyof ClientFormData, value: string) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (loading) return;
    const found = validateClientForm(formData, formMode);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      let createdClient: HospedeSuccessClient | undefined;
      const payload = clientPayload(formData, formMode);
      if (mode === "editar" && hospedeId) {
        await apiClient.put(`/api/client/${hospedeId}`, payload);
        toast.success("Hóspede atualizado com sucesso!");
      } else {
        const response = await apiClient.post<HospedeSuccessClient>("/api/client/create", payload);
        createdClient = response.data;
        toast.success("Hóspede cadastrado com sucesso!");
      }
      onSuccess?.(createdClient);
      onClose();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Erro ao salvar hóspede."));
    } finally {
      setLoading(false);
    }
  };

  const titulo = mode === "editar" ? "Editar hóspede" : mode === "excluir" ? "Excluir hóspede" : "Adicionar hóspede";

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={titulo}
      description="Para reservar, informe nome e telefone. Complete os demais dados no check-in."
      closeLabel="Fechar cadastro de hóspede"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="primary" type="submit" form={formId} disabled={loading || Boolean(loadError)}>
            {loading && <Loader2 aria-hidden="true" className="animate-spin" />}
            {mode === "editar" ? "Salvar alterações" : "Adicionar hóspede"}
          </Button>
        </>
      )}
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {loadError && <p role="alert" className="m-0 text-[13px] text-danger">{loadError}</p>}
        <ClientFields value={formData} onChange={handleChange} errors={errors} withVehicle disabled={loading && mode === "editar" && !formData.fullName} />
      </form>
    </Sheet>
  );
}
