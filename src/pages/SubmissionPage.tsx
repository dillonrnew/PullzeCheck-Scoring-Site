import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import imageCompression from 'browser-image-compression';
import '../styles/SubmissionPage.css';
import TopBar from '../components/TopBar';

type Team = {
  id: number;
  tournament_id: number;
  team_number: number;
  name: string;
  player1_name: string;
  player2_name: string;
  player3_name: string;
};

const TeamPage: React.FC = () => {
  const { tournamentId, teamNumber } = useParams<{ tournamentId: string; teamNumber: string }>();

  // Guards + convert to numbers
  if (!tournamentId || !teamNumber || Number.isNaN(Number(tournamentId)) || Number.isNaN(Number(teamNumber))) {
    return <p>Invalid route. Expected /submit/:tournamentId/:teamNumber</p>;
  }

  const tId = Number(tournamentId);
  const tNum = Number(teamNumber);

  const [team, setTeam] = useState<Team | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(true);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [selectedMap, setSelectedMap] = useState<number>(1);
  const [placement, setPlacement] = useState<number>(0);
  const [playerKills, setPlayerKills] = useState(['', '', '']);
  const [submitting, setSubmitting] = useState(false);

  const pasteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSelectMap = (mapNum: number) => {
    setSelectedMap(mapNum);
  };

  // Compression options
  const compressionOptions = {
    maxSizeMB: 0.8,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
  };

  // Fetch team by tournament_id + team_number
  useEffect(() => {
    const fetchTeam = async () => {
      setLoadingTeam(true);

      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', tId)
        .eq('team_number', tNum)
        .limit(1);

      if (error) {
        console.error('Error fetching team:', error);
        setTeam(null);
      } else {
        setTeam(data?.[0] ?? null);
      }

      setLoadingTeam(false);
    };

    fetchTeam();
  }, [tId, tNum]);

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedFile = await imageCompression(file, compressionOptions);
      setImageFile(compressedFile);
      setImagePreview(URL.createObjectURL(compressedFile));
    } catch (error) {
      console.error('Image compression failed:', error);
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Shared image processing
  const processPastedImage = async (file: File) => {
    try {
      const compressedFile = await imageCompression(file, compressionOptions);
      setImageFile(compressedFile);
      setImagePreview(URL.createObjectURL(compressedFile));
    } catch (error) {
      console.error('Paste compression failed:', error);
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Paste in textarea
  const handleTextareaPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!e.clipboardData) return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await processPastedImage(file);
        }
      }
    }
  };

  // Global paste fallback
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (document.activeElement === pasteTextareaRef.current) return;

      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            await processPastedImage(file);
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!team) {
      alert('Team not found. Please check the link and try again.');
      return;
    }

    if (!imageFile) {
      alert('Please upload or paste a scoreboard image.');
      return;
    }

    // Validate kills are numbers and not empty
    const killsNums = playerKills.map((k) => (k === '' ? 0 : Number(k)));
    if (killsNums.some((n) => Number.isNaN(n))) {
      alert('Please enter valid numbers for player kills.');
      return;
    }

    setSubmitting(true);

    try {
      const fileName = `t${tournamentId}_team${teamNumber}_teamId${team.id}_map${selectedMap}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('scoreboards')
        .upload(fileName, imageFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('scoreboards')
        .getPublicUrl(fileName);

      const imageUrl = publicData.publicUrl;

      const { error: insertError } = await supabase.from('submissions').insert({
        team_id: team.id,
        tournament_id: team.tournament_id,
        map_number: selectedMap,
        player1_kills: killsNums[0],
        player2_kills: killsNums[1],
        player3_kills: killsNums[2],
        placement,
        scoreboard_image_url: imageUrl,
      });

      if (insertError) throw insertError;

      alert('Submission uploaded successfully!');

      // Reset form
      setSelectedMap((prev) => Math.min(prev + 1, 15));
      setPlacement(0);
      setPlayerKills(['', '', '']);
      setImageFile(null);
      setImagePreview('');
    } catch (error: any) {
      console.error('Submission error:', error);
      alert('Failed to submit. Check console for details.');
    } finally {
      setSubmitting(false);
    }
  };

  // Dynamic placeholder for paste textarea
  const pastePlaceholder = imagePreview
    ? '✓ Image added – Ctrl+V to replace'
    : 'Click here and press Ctrl+V to paste your scoreboard screenshot...';

  if (loadingTeam) {
    return (
      <div className="team-page">
        <div className="form-container">
          <h1>Loading team...</h1>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="team-page">
        <div className="form-container">
          <h1>Team Not Found</h1>
          <p>
            No team #{teamNumber} found for tournament {tournamentId}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="team-page">
      <h1 style={{ textAlign: 'center' }}>Submit Your Score</h1>

      <TopBar selectedMap={selectedMap} onSelectMap={handleSelectMap} />

      <div className="form-container">
        <form onSubmit={handleSubmit}>
          <label>Map Placement</label>
          <select value={placement || ''} onChange={(e) => setPlacement(Number(e.target.value))} required>
            <option value="" disabled>
              Select placement
            </option>
            {Array.from({ length: 17 }, (_, i) => i + 1).map((i) => (
              <option key={i} value={i}>
                {i}
                {i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'}
              </option>
            ))}
          </select>

          {[team.player1_name, team.player2_name, team.player3_name].map((player, idx) => (
            <div key={idx} className="kills-input-group">
              <label>{player} Kills</label>
              <input
                type="number"
                value={playerKills[idx]}
                onChange={(e) =>
                  setPlayerKills((prev) => {
                    const copy = [...prev];
                    copy[idx] = e.target.value;
                    return copy;
                  })
                }
                min="0"
                placeholder=""
                required
              />
            </div>
          ))}

          <label>Scoreboard Image</label>
          <input type="file" accept="image/*" onChange={handleFileChange} />

          <label htmlFor="paste-area">Or paste your screenshot here:</label>
          <textarea
            id="paste-area"
            ref={pasteTextareaRef}
            placeholder={pastePlaceholder}
            rows={4}
            onPaste={handleTextareaPaste}
            className="paste-textarea"
          />

          {imagePreview && (
            <div className="preview-container">
              <p className="preview-label">Preview:</p>
              <div className="image-wrapper">
                <img src={imagePreview} alt="Scoreboard Preview" />
              </div>
            </div>
          )}

          <button type="submit" className="submit-score-btn" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Score'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TeamPage;
