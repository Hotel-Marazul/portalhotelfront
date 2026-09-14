"use client";
import { Suspense, lazy } from 'react';
import { Box, CircularProgress } from '@mui/material';
import PageHeader from '../../components/layout/PageHeader';
import PageSection from '../../components/layout/PageSection';

const Clientes = lazy(() => import("../../components/clientes/createUserTable"));

export default function ClienteTable() {
  return (
    <div className="page-content">
      <PageHeader
        title="Hóspedes"
        description="Cadastre pessoas, encontre contatos e consulte o histórico de estadias."
      />
      <PageSection
        title="Cadastro e histórico"
        description="A agenda e a disponibilidade agora ficam juntas em Agenda."
      >
        <Suspense fallback={<Box display="flex" justifyContent="center" p={3}><CircularProgress size={32} /></Box>}>
          <Clientes />
        </Suspense>
      </PageSection>
    </div>
  );
}
