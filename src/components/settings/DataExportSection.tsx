import { DatabaseBackup, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Download do backup completo (JSON). Restaurar a partir dele ainda não é suportado. */
export function DataExportSection() {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DatabaseBackup size={16} className="text-indigo-400" />
          Backup dos dados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-zinc-400">
          Baixa um arquivo JSON com contas, membros, categorias, transações, orçamentos,
          investimentos (operações, proventos e histórico de preços), regras de categorização e
          metas de alocação. A senha não é incluída. Guarde o arquivo em um lugar seguro: ele
          contém todo o seu histórico financeiro.
        </p>
        <Button variant="outline" asChild>
          <a href="/api/export/backup" download>
            <Download size={16} />
            Baixar backup (JSON)
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
