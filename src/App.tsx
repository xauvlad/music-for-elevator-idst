import { useEffect, useMemo, useRef, useState } from 'react';
import { bonusLink, channelUrl, codeWord, floors, type Floor } from './data/floors';
import { dispatcherDialogs } from './data/dispatcher';

type Screen = 'gate' | 'home' | 'floor' | 'code';
type GateState = 'checking' | 'not_subscribed' | 'error';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
        onEvent?: (eventType: string, handler: () => void) => void;
        offEvent?: (eventType: string, handler: () => void) => void;
      };
    };
  }
}

const DOOR_CLOSE_TIME = 500;
const ELEVATOR_TRAVEL_TIME = 1200;
const BUTTON_PRESS_DELAY = 250;

/** True when the Mini App runs inside Telegram with signed init data (subscription check possible). */
function hasTelegramInitData(): boolean {
  return typeof window !== 'undefined' && Boolean((window.Telegram?.WebApp?.initData ?? '').trim());
}

function App() {
  const [screen, setScreen] = useState<Screen>(() => (hasTelegramInitData() ? 'gate' : 'home'));
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  /** Telegram: open on load (gate copy sits under doors). Browser: closed first, then open animation. */
  const [doorsClosed, setDoorsClosed] = useState(() => (hasTelegramInitData() ? false : true));
  const [word, setWord] = useState('');
  const [wordAccepted, setWordAccepted] = useState(false);
  const [wordError, setWordError] = useState('');
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [gateState, setGateState] = useState<GateState>('checking');
  const [currentIndicatorFloor, setCurrentIndicatorFloor] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [lightBeam, setLightBeam] = useState(false);
  const [lightBeamFloor, setLightBeamFloor] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogIndex, setDialogIndex] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const buttonAudioRef = useRef<HTMLAudioElement | null>(null);
  const elevatorAudioRef = useRef<HTMLAudioElement | null>(null);
  const dingAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const dispatcherAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    buttonAudioRef.current = new Audio('/button.mp3');
    buttonAudioRef.current.preload = 'auto';

    elevatorAudioRef.current = new Audio('/elevator.mp3');
    elevatorAudioRef.current.preload = 'auto';

    dingAudioRef.current = new Audio('/sound.mp3');
    dingAudioRef.current.preload = 'auto';

    bgMusicRef.current = new Audio('/music.mp3');
    bgMusicRef.current.preload = 'auto';
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.25;
  }, []);

  useEffect(() => {
  if (bgMusicRef.current) {
    bgMusicRef.current.volume = 0.25;

    if (isMuted) {
      bgMusicRef.current.pause();
    } else {
      void bgMusicRef.current.play().catch(() => {});
    }
  }

  if (dispatcherAudioRef.current) {
    dispatcherAudioRef.current.muted = isMuted;
  }
}, [isMuted]);

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
  }, []);

  useEffect(() => {
    if (selectedFloor) {
      setCurrentIndicatorFloor(selectedFloor.id);
    }
  }, [selectedFloor]);

  useEffect(() => {
  if (!isDialogOpen) {
    setTypedText('');
    setIsTyping(false);
    return;
  }

  const dialog = dispatcherDialogs[!selectedFloor ? 6 as keyof typeof dispatcherDialogs : selectedFloor.id as keyof typeof dispatcherDialogs];
  if (!dialog) return;

  const fullText = dialog.lines[dialogIndex].text;
  let index = 0;

  setTypedText('');
  setIsTyping(true);

  const interval = window.setInterval(() => {
    index += 1;
    setTypedText(fullText.slice(0, index));

    if (index >= fullText.length) {
      window.clearInterval(interval);
      setIsTyping(false);
    }
  }, 22);

  return () => {
    window.clearInterval(interval);
  };
}, [isDialogOpen, selectedFloor, dialogIndex]);

  const title = useMemo(() => {
    if (doorsClosed) return 'Едем...';
    if (screen === 'floor' && selectedFloor) return `ЭТАЖ ${selectedFloor.id}`;
    if (screen === 'code') return 'КОДОВОЕ СЛОВО';
    if (screen === 'home') return 'ВЫБЕРИТЕ ЭТАЖ';
    if (gateState === 'checking') return 'ПРОВЕРКА ПОДПИСКИ';
    return 'ПРОВЕРКА ДОСТУПА';
  }, [screen, selectedFloor, gateState, doorsClosed]);

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const ensureBackgroundMusic = () => {
    try {
      if (!isMuted && bgMusicRef.current && bgMusicRef.current.paused) {
        bgMusicRef.current.volume = 0.35;
        void bgMusicRef.current.play().catch(() => {});
      }
    } catch {}
  };

  const playButtonFeedback = () => {
    ensureBackgroundMusic();

    try {
      navigator.vibrate?.(35);
    } catch {}

    if (isMuted) return;

    try {
      if (buttonAudioRef.current) {
        buttonAudioRef.current.currentTime = 0;
        void buttonAudioRef.current.play();
      }
    } catch {}
  };

  const playDoorCloseSound = () => {
    if (isMuted) return;

    try {
      if (elevatorAudioRef.current) {
        elevatorAudioRef.current.currentTime = 0;
        void elevatorAudioRef.current.play();
      }
    } catch {}
  };

  const playDoorOpenSound = () => {
    if (isMuted) return;

    try {
      if (dingAudioRef.current) {
        dingAudioRef.current.currentTime = 0;
        void dingAudioRef.current.play();
      }
    } catch {}
  };

  const withDoorTransition = (action: () => void, delay = DOOR_CLOSE_TIME) => {
    setDoorsClosed(true);
    playDoorCloseSound();

    window.setTimeout(() => {
      action();
      playDoorOpenSound();
      setDoorsClosed(false);
    }, delay + ELEVATOR_TRAVEL_TIME);
  };

  const animateFloorIndicator = (fromFloor: number, toFloor: number) => {
    const direction = fromFloor <= toFloor ? 1 : -1;
    const route: number[] = [];

    for (
      let floor = fromFloor;
      direction === 1 ? floor <= toFloor : floor >= toFloor;
      floor += direction
    ) {
      route.push(floor);
    }

    if (route.length === 0) {
      setCurrentIndicatorFloor(toFloor);
      return;
    }

    const stepDuration = Math.max(120, Math.floor(ELEVATOR_TRAVEL_TIME / route.length));

    route.forEach((floorNumber, index) => {
      window.setTimeout(() => {
        setCurrentIndicatorFloor(floorNumber);
      }, index * stepDuration);
    });
  };

  const verifySubscription = async () => {
    if (import.meta.env.DEV) {
      setSubscribed(true);
      setGateState('checking');

      if (screen !== 'home') {
        withDoorTransition(() => setScreen('home'));
      }
      return;
    }

    if (!hasTelegramInitData()) {
      return;
    }

    try {
      setGateState('checking');

      const initData = window.Telegram?.WebApp?.initData;

      if (!initData) {
        setGateState('error');
        setSubscribed(false);
        setScreen('gate');
        return;
      }

      const response = await fetch('/api/check-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });

      const data = await response.json();

      if (!data?.ok) {
        setGateState('error');
        setSubscribed(false);
        setScreen('gate');
        return;
      }

      if (data.isSubscribed) {
        setSubscribed(true);
        setGateState('checking');

        if (screen !== 'home') {
          withDoorTransition(() => setScreen('home'));
        }
      } else {
        setSubscribed(false);
        setGateState('not_subscribed');
        setScreen('gate');
      }
    } catch {
      setGateState('error');
      setSubscribed(false);
      setScreen('gate');
    }
  };

  useEffect(() => {
    void verifySubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasTelegramInitData()) return;
    const id = window.setTimeout(() => {
      playDoorOpenSound();
      setDoorsClosed(false);
    }, DOOR_CLOSE_TIME);
    return () => window.clearTimeout(id);
    // playDoorOpenSound is stable enough for mount-only browser intro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const recheckOnReturn = () => {
      if (screen === 'gate' && hasTelegramInitData()) {
        void verifySubscription();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        recheckOnReturn();
      }
    };

    const handleFocus = () => {
      recheckOnReturn();
    };

    const handleActivated = () => {
      recheckOnReturn();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.Telegram?.WebApp?.onEvent?.('activated', handleActivated);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.Telegram?.WebApp?.offEvent?.('activated', handleActivated);
    };
  }, [screen]);

  const handleSubscriptionCheck = () => {
    playButtonFeedback();
    setActiveButton('check');
    window.setTimeout(() => {
      setActiveButton(null);
      void verifySubscription();
    }, 220);
  };

  const openFloor = (floor: Floor) => {
  closeDispatcherDialog();
  playButtonFeedback();
  setActiveButton(`floor-${floor.id}`);

    window.setTimeout(() => {
      setDoorsClosed(true);
      playDoorCloseSound();

      const startFloor = currentIndicatorFloor ?? 1;
      animateFloorIndicator(startFloor, floor.id);

      window.setTimeout(() => {
        setActiveButton(null);
        setSelectedFloor(floor);
        setScreen('floor');
        setCurrentIndicatorFloor(floor.id);

        setLightBeamFloor(floor.id);
        setLightBeam(true);

        playDoorOpenSound();
        setDoorsClosed(false);

        window.setTimeout(() => {
          setLightBeam(false);
        }, 850);
      }, DOOR_CLOSE_TIME + ELEVATOR_TRAVEL_TIME);
    }, BUTTON_PRESS_DELAY);
  };

  const goHome = () => {
    playButtonFeedback();
    setActiveButton('back');
    setIsTransitioning(true);
    window.setTimeout(() => {
      setActiveButton(null);
        closeDispatcherDialog();
      setSelectedFloor(null);
      setScreen('home');
      setWord('');
      setWordAccepted(false);
      setWordError('');
      setTimeout(() => setIsTransitioning(false), 800);
    }, 180);
  };

  const openCodeScreen = () => {
    playButtonFeedback();
    setCurrentIndicatorFloor(0);
    setActiveButton('code');
    window.setTimeout(() => {
      setActiveButton(null);
      animateFloorIndicator(currentIndicatorFloor ?? 1, 0);
      withDoorTransition(() => {
        setWord('');
        setWordAccepted(false);
        setWordError('');
        setScreen('code');
      }, 700);
    }, BUTTON_PRESS_DELAY);
  };

  const checkWord = () => {
    playButtonFeedback();
    setActiveButton('check-word');

    window.setTimeout(() => {
      setActiveButton(null);

      if (word.trim().toLowerCase() === codeWord.toLowerCase()) {
        setWordAccepted(true);
        setWordError('');
        return;
      }

      setWordAccepted(false);
      setWordError('Лифт не распознал команду. Попробуйте ещё раз.');
    }, 180);
  };

  const stopDispatcherAudio = () => {
  try {
    if (dispatcherAudioRef.current) {
      dispatcherAudioRef.current.pause();
      dispatcherAudioRef.current.currentTime = 0;
    }
  } catch {}
};

const playDispatcherLine = (src: string) => {
  try {
    stopDispatcherAudio();
    dispatcherAudioRef.current = new Audio(src);

    if (isMuted) {
      dispatcherAudioRef.current.muted = true;
      return;
    }

    void dispatcherAudioRef.current.play().catch(() => {});
  } catch {}
};

const openDispatcherDialog = () => {

  const dialog = dispatcherDialogs[!selectedFloor ? 6 as keyof typeof dispatcherDialogs : selectedFloor.id as keyof typeof dispatcherDialogs];
  if (!dialog || !dialog.lines.length) return;

  setDialogIndex(0);
  setIsDialogOpen(true);

  playDispatcherLine(dialog.lines[0].audio);
};

const nextDispatcherLine = () => {

  const dialog = dispatcherDialogs[!selectedFloor ? 6 as keyof typeof dispatcherDialogs : selectedFloor.id as keyof typeof dispatcherDialogs];
  if (!dialog) return;

  const nextIndex = dialogIndex + 1;

  if (nextIndex < dialog.lines.length) {
    setDialogIndex(nextIndex);
    playDispatcherLine(dialog.lines[nextIndex].audio);
    return;
  }

  stopDispatcherAudio();
  setIsDialogOpen(false);
  setDialogIndex(0);
};

const closeDispatcherDialog = () => {
  stopDispatcherAudio();
  setIsDialogOpen(false);
  setDialogIndex(0);
};

  const isIndicatorActive = (id: number | string) => {
    if (screen === 'code') return id === 'K';
    return currentIndicatorFloor === id;
  };

  const lightBeamClass =
    lightBeamFloor === 1
      ? 'beam-floor-1'
      : lightBeamFloor === 2
      ? 'beam-floor-2'
      : lightBeamFloor === 3
      ? 'beam-floor-3'
      : lightBeamFloor === 4
      ? 'beam-floor-4'
      : lightBeamFloor === 5
      ? 'beam-floor-5'
      : '';

  const inTelegramMiniApp = hasTelegramInitData();

  return (
    <div className="app-shell">
      <div className="shell-floating-actions" role="toolbar" aria-label="Системные действия">
        {!inTelegramMiniApp && (
          <a
            className="tg-button"
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Канал idst в Telegram"
          >
            <span aria-hidden="true"></span>
          </a>
        )}
        <button className="mute-button" type="button" onClick={toggleMute} aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}>
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      <div className="elevator-frame">
        <header className="elevator-header">
          <div className="top-display-panel">
            <div className={`display ${screen === 'home' ? 'panel-display-blink' : ''} panel-display`}>
              {title}
            </div>
          </div><div className="indicator-panel">
            <div className="floor-indicator">
              {(['K', 1, 2, 3, 4, 5] as const).map((id) => (
                <span
                  key={id}
                  className={`floor-indicator-item ${isIndicatorActive(id) ? 'active' : ''}`}
                  onClick={() => {
                    if (id === 'K') {
                      closeDispatcherDialog();
                      openCodeScreen();
                      return;
                    }
                    const floor = floors.find((f) => f.id === id);
                    if (floor) openFloor(floor);
                  }}
                >
                  {id}
                </span>
              ))}
            </div>
          </div>
        </header>

        <main className={`elevator-stage ${wordError ? 'error-halo' : wordAccepted ? 'success-halo' : ''}`}>
          <div className={`doors ${doorsClosed ? 'closed' : 'open'}`} aria-hidden="true">
            <div className="door left">
              <img src="/door-left.png" alt="" />
            </div>
            <div className="door right">
              <img src="/door-right.png" alt="" />
            </div>
          </div>

          {lightBeam && <div className={`light-beam ${lightBeamClass}`} />}
          {isDialogOpen && dispatcherDialogs[!selectedFloor ? 6 as keyof typeof dispatcherDialogs : selectedFloor.id as keyof typeof dispatcherDialogs] && (
  <div className="dispatcher-dialog">
    <img
      src={dispatcherDialogs[!selectedFloor ? 6 as keyof typeof dispatcherDialogs : selectedFloor.id as keyof typeof dispatcherDialogs].portrait}
      alt="Диспетчер"
      className="dispatcher-portrait"
    />

    <div className="dispatcher-panel">
      <div className="dispatcher-name">Диспетчер</div>

      <div className="dispatcher-text dispatcher-text-typing">
  {typedText}
  {isTyping && <span className="dispatcher-caret" />}
</div>

<button className="dispatcher-next" onClick={nextDispatcherLine}>
  {dialogIndex ===
  dispatcherDialogs[!selectedFloor ? 6 as keyof typeof dispatcherDialogs : selectedFloor.id as keyof typeof dispatcherDialogs].lines.length - 1
    ? 'Конец'
    : 'Далее...'}
</button>
    </div>
  </div>
)}

          <section className={`screen-content ${isTransitioning ? 'screen-transition' : ''}`}>
            {screen === 'gate' && (
              <div className="screen-block center-block">
                {gateState === 'checking' && (
                  <>
                    <p className="lead">
                      Лифт проверяет вашу подписку на канал группы idst.
                    </p>

                    <div className="stack gap-md">
                      <button className="wide-button secondary" disabled>
                        Проверка...
                      </button>
                    </div>
                  </>
                )}

                {gateState === 'not_subscribed' && (
                  <>
                    <p className="lead">
                      Чтобы вызвать лифт, подпишитесь на канал группы idst.
                    </p>

                    <div className="stack gap-md">
                      <a className="wide-button secondary" href={channelUrl} target="_blank" rel="noreferrer">
                        Подписаться на канал
                      </a>

                      <button
                        className={`wide-button ${activeButton === 'check' ? 'is-pressed' : ''}`}
                        onClick={handleSubscriptionCheck}
                      >
                        Проверить подписку
                      </button>
                    </div>
                  </>
                )}

                {gateState === 'error' && (
                  <>
                    <p className="lead">
                      Лифт не смог проверить подписку. Откройте приложение из Telegram и попробуйте ещё раз.
                    </p>

                    <div className="stack gap-md">
                      <button
                        className={`wide-button ${activeButton === 'check' ? 'is-pressed' : ''}`}
                        onClick={handleSubscriptionCheck}
                      >
                        Проверить ещё раз
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {screen === 'home' && (
              <div className="screen-block home-screen">
                <div className="elevator-panel">
                  <button className={`elevator-btn-disp`}
                  onClick={openDispatcherDialog}>вызов диспетчера</button>

                  <div className="panel-buttons">
                    {floors.map((floor) => (
                      <button
                        key={floor.id}
                        className={`elevator-btn btn-floor-${floor.id} ${activeButton === `floor-${floor.id}` ? 'is-pressed' : ''}`}
                        onClick={() => openFloor(floor)}
                      >
                        {floor.id}
                      </button>
                    ))}

                    <a
                      className="elevator-btn elevator-btn-music btn-floor-6"
                      href="https://music.yandex.ru/artist/6380387"
                      target="_blank"
                      rel="noreferrer"
                      onClick={playButtonFeedback}
                    >
                      idst
                    </a>
                  </div>

                  <button
                    className={`code-elevator-btn ${activeButton === 'code' ? 'is-pressed' : ''}`}
                    onClick={openCodeScreen}
                  >
                    КОДОВОЕ СЛОВО
                  </button>
                </div>

                <p className="hint home-hint">
                  Для полного погружения рекомендуем отключить беззвучный режим вашего девайса.
                </p>
              </div>
            )}

            {screen === 'floor' && selectedFloor && (
              <div className="screen-block floor-screen">
                <div className="floor-card">
                 <img
  src={selectedFloor.image}
  alt={selectedFloor.title}
  className={`floor-image floor-style-${selectedFloor.id}`}
/>

                  <div className="floor-copy">
                   <button className="floor-badge dispatcher-badge" onClick={openDispatcherDialog}>
  Вызов диспетчера
</button>
                    <h1>{selectedFloor.title}</h1>
                    <p>{selectedFloor.description}</p>

                    <div className="floor-actions">
                      <a className="wide-button" href={selectedFloor.musicUrl} target="_blank" rel="noreferrer">
                        Слушать на Яндекс Музыке
                      </a>

                      <button
                        className={`wide-button secondary ${activeButton === 'back' ? 'is-pressed' : ''}`}
                        onClick={goHome}
                      >
                        Назад
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {screen === 'code' && (
              <div className="screen-block center-block code-screen">
                <p className="lead">
                  Введите кодовое слово, чтобы открыть бонус-трек.
                </p>

                <label className="code-input-wrap">

  <input
    value={word}
    onChange={(e) => setWord(e.target.value)}
    placeholder="Введите слово"
    className="code-input"
  />

  <span className="code-hint code-hint-blink">
    Найти верное слово вам помогут видеошоты альбома на Яндекс Музыке.
  </span>
</label>

                <div className="stack gap-md">
                  <button
                    className={`wide-button ${activeButton === 'check-word' ? 'is-pressed' : ''}`}
                    onClick={checkWord}
                  >
                    Проверить
                  </button>

                  <button
                    className={`wide-button secondary ${activeButton === 'back' ? 'is-pressed' : ''}`}
                    onClick={goHome}
                  >
                    Назад
                  </button>
                </div>

                {wordAccepted && (
                  <div className="result-box success">
                    <p>Код принят. Допуск открыт.</p>

                    <a className="wide-button" href={bonusLink} target="_blank" rel="noreferrer">
                      Получить бонус-трек
                    </a>
                  </div>
                )}

                {!wordAccepted && wordError && (
                  <div className="result-box error">
                    {wordError}
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
        
      </div>
    </div>
  );
}

export default App;
