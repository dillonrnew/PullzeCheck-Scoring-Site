import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import imageCompression from 'browser-image-compression';
import '../styles/teamPage.css';

const TeamPage: React.FC<{ teamId: number }> = ({ teamId }) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [mapNumber, setMapNumber] = useState<number>(1);
  const [placement, setPlacement] = useState<number>(0);
  const [playerKills, setPlayerKills] = useState(['', '', '']); // Empty strings instead of 0s
  const [submitting, setSubmitting] = useState(false);

  const pasteTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Compression options
  const compressionOptions = {
    maxSizeMB: 0.8,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
  };

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
    if (!imageFile) {
      alert('Please upload or paste a scoreboard image.');
      return;
    }

    // Validate kills are numbers and not empty
    const killsNums = playerKills.map(k => k === '' ? 0 : Number(k));
    if (killsNums.some(isNaN)) {
      alert('Please enter valid numbers for player kills.');
      return;
    }

    setSubmitting(true);

    try {
      const fileName = `team${teamId}_map${mapNumber}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('scoreboards')
        .upload(fileName, imageFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('scoreboards')
        .getPublicUrl(fileName);

      const imageUrl = publicData.publicUrl;

      const { error: insertError } = await supabase
        .from('submissions')
        .insert({
          team_id: teamId,
          map_number: mapNumber,
          player1_kills: killsNums[0],
          player2_kills: killsNums[1],
          player3_kills: killsNums[2],
          placement,
          scoreboard_image_url: imageUrl,
        });

      if (insertError) throw insertError;

      alert('Submission uploaded successfully!');

      // Reset form
      setMapNumber(prev => prev + 1);
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

  return (
    <div className="team-page">
      <div className="form-container">
        <h1>Submit Your Score</h1>
        <form onSubmit={handleSubmit}>
          <label>Map Number</label>
          <input
            type="number"
            value={mapNumber}
            onChange={e => setMapNumber(Number(e.target.value))}
            min="1"
            required
          />

          <label>Map Placement</label>
          <select
            value={placement || ''}
            onChange={e => setPlacement(Number(e.target.value))}
            required
          >
            <option value="" disabled>Select placement</option>
            {Array.from({ length: 16 }, (_, i) => i + 1).map(i => (
              <option key={i} value={i}>
                {i}{i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'}
              </option>
            ))}
          </select>

          {['Player 1', 'Player 2', 'Player 3'].map((player, idx) => (
            <div key={idx} className="kills-input-group">
              <label>{player} Kills</label>
              <input
                type="number"
                value={playerKills[idx]}
                onChange={e =>
                  setPlayerKills(prev => {
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

          <button type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Score'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TeamPage;