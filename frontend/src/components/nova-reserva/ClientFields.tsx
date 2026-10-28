"use client";

import Field from "../ui/Field";
import Input from "../ui/Input";
import { formatDocument, type ClientFormData, type ClientFormErrors } from "./nova-reserva-data";

interface ClientFieldsProps {
  value: ClientFormData;
  onChange: (field: keyof ClientFormData, value: string) => void;
  errors?: ClientFormErrors;
  // Automóvel e placa ficam para o cadastro completo; na nova reserva, o check-in completa.
  withVehicle?: boolean;
  disabled?: boolean;
}

// Campos do cliente, iguais no cadastro de hóspede e no cadastro dentro da nova reserva.
export default function ClientFields({ value, onChange, errors = {}, withVehicle = false, disabled }: ClientFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Nome completo" required error={errors.fullName}>
        <Input name="fullName" autoComplete="name" value={value.fullName} disabled={disabled}
          onChange={(event) => onChange("fullName", event.target.value)} />
      </Field>
      <Field label="Telefone" required error={errors.fone}>
        <Input name="fone" type="tel" autoComplete="tel" value={value.fone} disabled={disabled}
          onChange={(event) => onChange("fone", event.target.value)} />
      </Field>
      <Field label="CPF" hint="Opcional na reserva. Pode ser preenchido no check-in." error={errors.cpf}>
        <Input name="cpf" inputMode="numeric" placeholder="000.000.000-00" className="[&_input]:font-mono"
          value={formatDocument(value.cpf)} disabled={disabled}
          onChange={(event) => onChange("cpf", event.target.value.includes("*") ? event.target.value : event.target.value.replace(/\D/g, ""))} />
      </Field>
      <Field label="E-mail" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" placeholder="opcional" value={value.email} disabled={disabled}
          onChange={(event) => onChange("email", event.target.value)} />
      </Field>
      {withVehicle && (
        <>
          <Field label="Automóvel">
            <Input name="automovel" value={value.automovel} disabled={disabled}
              onChange={(event) => onChange("automovel", event.target.value)} />
          </Field>
          <Field label="Placa">
            <Input name="placa" className="[&_input]:font-mono [&_input]:uppercase" value={value.placa} disabled={disabled}
              onChange={(event) => onChange("placa", event.target.value)} />
          </Field>
        </>
      )}
    </div>
  );
}
