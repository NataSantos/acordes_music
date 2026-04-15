import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [professores, setProfessores] = useState<
    {
      id: string;
      nome: string;
      email: string;
      telefone?: string | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState("");

  useEffect(() => {
    const backendUrl = "http://localhost:3000";

    async function load() {
      try {
        const testResponse = await fetch(`${backendUrl}/api/test`);
        if (!testResponse.ok) {
          throw new Error("Falha na rota de teste do backend");
        }
        const testData = await testResponse.json();
        setBackendStatus(
          String(testData.message ?? testData.status ?? "Backend funcionando"),
        );

        const response = await fetch(`${backendUrl}/api/professores`);
        if (!response.ok) {
          throw new Error("Erro ao carregar professores");
        }
        const data = await response.json();
        setProfessores(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <main className="app-container">
      <section className="status-card">
        <h1>Integração Backend</h1>
        {loading ? (
          <p>Carregando...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : (
          <>
            <p className="success">{backendStatus}</p>
            <h2>Professores</h2>
            {professores.length === 0 ? (
              <p>Nenhum professor encontrado.</p>
            ) : (
              <table className="professores-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Telefone</th>
                  </tr>
                </thead>
                <tbody>
                  {professores.map((professor) => (
                    <tr key={professor.id}>
                      <td>{professor.nome}</td>
                      <td>{professor.email}</td>
                      <td>{professor.telefone ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default App;
