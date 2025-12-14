// src/components/TeamsGrid.tsx
import { useState, useEffect } from 'react';
import TeamCard from './TeamCard';
import '../styles/TeamsGrid.css';
import { supabase } from '../supabaseClient'; // adjust path if needed

// Exact match to your current teams table
type Team = {
  id: number;
  name: string;
  short_name: string | null;
  logo_url: string;
  player1_name: string;
  player2_name: string;
  player3_name: string;
};

const TeamsGrid: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);

    useEffect(() => {
    const fetchTeams = async () => {
        const { data, error } = await supabase
            .from('teams')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;


        setTeams(data ?? []);
    };

    fetchTeams();
    }, []);

  return (
    <div className="teams-grid-container">
      <h1 className="grid-title">Select Your Team</h1>

      {teams.length === 0 ? (
        <p>No teams registered yet.</p>
      ) : (
        <div className="teams-grid">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamsGrid;