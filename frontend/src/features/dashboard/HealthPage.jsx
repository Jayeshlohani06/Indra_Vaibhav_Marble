
import { useEffect, useState } from "react";
import { getHealth } from "../../services/api/healthApi";

function HealthPage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHealth() {
      try {
        const response = await getHealth();
        setHealth(response.data);
      } catch (err) {
        setError(err.message || "Unable to connect to backend");
      } finally {
        setLoading(false);
      }
    }

    loadHealth();
  }, []);

  if (loading) return <p>Checking system health...</p>;

  if (error) {
    return (
      <main>
        <h1>Indra Vaibhav Marble</h1>
        <p>Backend connection failed: {error}</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Indra Vaibhav Marble</h1>
      <h2>System Health</h2>
      <p>Application: {health.status}</p>
      <p>Service: {health.service}</p>
      <p>Database: {health.database}</p>
    </main>
  );
}

export default HealthPage;
