import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/TeamCard.css';

type ProfileRow = {
  id: string;
  gamertag: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  tourneyId: string;

  onCreate: (payload: {
    teamName: string;
    player1UserId: string; // captain / current user
    player2UserId: string | null;
    player3UserId: string | null;
  }) => Promise<void> | void;
};

const CreateTeamModal: React.FC<Props> = ({ open, onClose, tourneyId, onCreate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileRow | null>(null);

  // Team name
  const [teamName, setTeamName] = useState('');

  // slot states
  const [p2Text, setP2Text] = useState('');
  const [p3Text, setP3Text] = useState('');

  const [p2Selected, setP2Selected] = useState<ProfileRow | null>(null);
  const [p3Selected, setP3Selected] = useState<ProfileRow | null>(null);

  // suggestions
  const [p2Sug, setP2Sug] = useState<ProfileRow[]>([]);
  const [p3Sug, setP3Sug] = useState<ProfileRow[]>([]);
  const [activeField, setActiveField] = useState<'p2' | 'p3' | null>(null);

  const p2WrapRef = useRef<HTMLDivElement>(null);
  const p3WrapRef = useRef<HTMLDivElement>(null);

  // ----------------------------
  // Load "me" (current user profile)
  // ----------------------------
  useEffect(() => {
    if (!open) return;

    const run = async () => {
      setLoading(true);
      setError(null);

      setMe(null);
      setTeamName('');
      setP2Text('');
      setP3Text('');
      setP2Selected(null);
      setP3Selected(null);
      setP2Sug([]);
      setP3Sug([]);
      setActiveField(null);

      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const userId = authData.user?.id;
        if (!userId) {
          setError('You must be logged in to create a team.');
          setLoading(false);
          return;
        }

        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('id, gamertag')
          .eq('id', userId)
          .single();

        if (profErr) throw profErr;

        setMe(profile as ProfileRow);
      } catch (e: any) {
        console.error('CreateTeamModal init error:', e);
        setError(e?.message || 'Failed to load your profile.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [open]);

  // ----------------------------
  // Fetch suggestions (typeahead)
  // ----------------------------
  const fetchSuggestions = async (q: string, excludeIds: string[]) => {
    const query = q.trim();
    if (query.length < 1) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('id, gamertag')
      .ilike('gamertag', `%${query}%`)
      .limit(8);

    if (error) throw error;

    const rows = (data as ProfileRow[]).filter(
      (r) => r.gamertag && !excludeIds.includes(r.id)
    );

    const qLower = query.toLowerCase();
    rows.sort((a, b) => {
      const aStarts = (a.gamertag ?? '').toLowerCase().startsWith(qLower) ? 0 : 1;
      const bStarts = (b.gamertag ?? '').toLowerCase().startsWith(qLower) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return (a.gamertag ?? '').localeCompare(b.gamertag ?? '');
    });

    return rows;
  };

  const excludeIds = useMemo(() => {
    const ids: string[] = [];
    if (me?.id) ids.push(me.id);
    if (p2Selected?.id) ids.push(p2Selected.id);
    if (p3Selected?.id) ids.push(p3Selected.id);
    return ids;
  }, [me?.id, p2Selected?.id, p3Selected?.id]);

  // p2 suggestions
  useEffect(() => {
    if (!open) return;
    if (activeField !== 'p2') return;

    const run = async () => {
      try {
        const sug = await fetchSuggestions(p2Text, excludeIds);
        setP2Sug(sug);
      } catch (e) {
        console.error(e);
        setP2Sug([]);
      }
    };

    run();
  }, [p2Text, activeField, open, excludeIds]);

  // p3 suggestions
  useEffect(() => {
    if (!open) return;
    if (activeField !== 'p3') return;

    const run = async () => {
      try {
        const sug = await fetchSuggestions(p3Text, excludeIds);
        setP3Sug(sug);
      } catch (e) {
        console.error(e);
        setP3Sug([]);
      }
    };

    run();
  }, [p3Text, activeField, open, excludeIds]);

  // close suggestions if click outside
  useEffect(() => {
    if (!open) return;

    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      const inP2 = p2WrapRef.current?.contains(t);
      const inP3 = p3WrapRef.current?.contains(t);
      if (!inP2 && !inP3) {
        setActiveField(null);
      }
    };

    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const chooseP2 = (p: ProfileRow) => {
    setP2Selected(p);
    setP2Text(p.gamertag ?? '');
    setActiveField(null);
    setP2Sug([]);
  };

  const chooseP3 = (p: ProfileRow) => {
    setP3Selected(p);
    setP3Text(p.gamertag ?? '');
    setActiveField(null);
    setP3Sug([]);
  };

  const clearP2 = () => {
    setP2Selected(null);
    setP2Text('');
    setP2Sug([]);
  };

  const clearP3 = () => {
    setP3Selected(null);
    setP3Text('');
    setP3Sug([]);
  };

  const submit = async () => {
    setError(null);

    if (!me?.id) {
      setError('You must be logged in.');
      return;
    }

    if (!teamName.trim()) {
      setError('Team name is required.');
      return;
    }

    try {
      await onCreate({
        teamName: teamName.trim(),
        player1UserId: me.id,
        player2UserId: p2Selected?.id ?? null,
        player3UserId: p3Selected?.id ?? null,
      });

      onClose();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to create team.');
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Create team modal">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Create Team</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-subtitle">Tournament #{tourneyId}</div>

          {loading ? (
            <div className="modal-empty">Loading…</div>
          ) : (
            <>
              {error && <div className="modal-error">{error}</div>}

              {/* Team Name */}
              <div className="slot-row">
                <div className="slot-label">Team</div>
                <input
                  className="typeahead-input"
                  value={teamName}
                  placeholder="Team name..."
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>

              {/* Slot 1: You */}
              <div className="slot-row">
                <div className="slot-label">Player 1</div>
                <div className="slot-fixed">
                  {me?.gamertag ? me.gamertag : 'Your gamertag (set in profile)'}
                  <span className="slot-tag">You</span>
                </div>
              </div>

              {/* Slot 2 */}
              <div className="slot-row">
                <div className="slot-label">Player 2</div>

                <div className="typeahead-wrap" ref={p2WrapRef}>
                  <input
                    className="typeahead-input"
                    value={p2Text}
                    placeholder="Type gamertag..."
                    onFocus={() => setActiveField('p2')}
                    onChange={(e) => {
                      setP2Text(e.target.value);
                      setP2Selected(null);
                      setActiveField('p2');
                    }}
                  />

                  {p2Text && (
                    <button type="button" className="typeahead-clear" onClick={clearP2} aria-label="Clear player 2">
                      ×
                    </button>
                  )}

                  {activeField === 'p2' && p2Text.trim().length > 0 && p2Sug.length > 0 && (
                    <div className="typeahead-menu">
                      {p2Sug.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          className="typeahead-item"
                          onClick={() => chooseP2(p)}
                        >
                          {p.gamertag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Slot 3 */}
              <div className="slot-row">
                <div className="slot-label">Player 3</div>

                <div className="typeahead-wrap" ref={p3WrapRef}>
                  <input
                    className="typeahead-input"
                    value={p3Text}
                    placeholder="Type gamertag..."
                    onFocus={() => setActiveField('p3')}
                    onChange={(e) => {
                      setP3Text(e.target.value);
                      setP3Selected(null);
                      setActiveField('p3');
                    }}
                  />

                  {p3Text && (
                    <button type="button" className="typeahead-clear" onClick={clearP3} aria-label="Clear player 3">
                      ×
                    </button>
                  )}

                  {activeField === 'p3' && p3Text.trim().length > 0 && p3Sug.length > 0 && (
                    <div className="typeahead-menu">
                      {p3Sug.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          className="typeahead-item"
                          onClick={() => chooseP3(p)}
                        >
                          {p.gamertag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="modal-btn secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className="modal-btn primary" onClick={submit} disabled={!me?.id}>
                  Create Team
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateTeamModal;
