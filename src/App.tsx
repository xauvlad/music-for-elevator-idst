import { useEffect, useMemo, useRef, useState } from 'react';
import { bonusLink, channelUrl, codeWord, floors, type Floor } from './data/floors';

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

function App() {
  const [screen, setScreen] = useState<Screen>('gate');
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [doorsClosed, setDoorsClosed] = useState(false);
  const [word, setWord] = useState('');
  const [wordAccepted, setWordAccepted] = useState(false);
  const [wordError, setWordError] = useState('');
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [gateState, setGateState] = useState<GateState>('checking');
  const [currentIndicatorFloor, setCurrentIndicatorFloor] = useState<number | null>(null);
  const [lightBeam, setLightBeam] = useState(false);
  const [lightBeamFloor, setLightBeamFloor] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const buttonAudioRef = useRef<HTMLAudioElement | null>(null);
  const elevatorAudioRef = useRef<HTMLAudioElement | null>(null);
  const dingAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);

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
    bgMusicRef.current.volume = 0.35;
  }, []);

  useEffect(() => {
    if (bgMusicRef.current) {
      bgMusicRef.current.volume = 0.35;

      if (isMuted) {
        bgMusicRef.current.pause();
      } else {
        void bgMusicRef.current.play().catch(() => {});
      }
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

  const title = useMemo(() => {
    if (screen === 'floor' && selectedFloor) return `ЭТАЖ ${selectedFloor.id}`;
    if (screen === 'code') return 'КОДОВОЕ СЛОВО';
    if (screen === 'home') return 'ВЫБЕРИТЕ ЭТАЖ';
    if (gateState === 'checking') return 'ПРОВЕРКА ПОДПИСКИ';
    return 'ПРОВЕРКА ДОСТУПА';
  }, [screen, selectedFloor, gateState]);

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
    const recheckOnReturn = () => {
      if (screen === 'gate') {
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
    window.setTimeout(() => {
      setActiveButton(null);
      withDoorTransition(() => {
        setSelectedFloor(null);
        setScreen('home');
        setWord('');
        setWordAccepted(false);
        setWordError('');
      }, 180);
    }, 180);
  };

  const openCodeScreen = () => {
    playButtonFeedback();
    setActiveButton('code');
    window.setTimeout(() => {
      setActiveButton(null);
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

  const isIndicatorActive = (id: number) => {
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

  return (
    <div className="app-shell">
      <button className="mute-button" onClick={toggleMute} aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}>
        {isMuted ? '🔇' : '🔊'}
      </button>

      <div className="elevator-frame">
        <header className="display-panel">
          {/* <div className="brand">idst — Музыка для лифта</div> */}
          
          {/* {screen !== 'home' && (
            <div className={`display`}>
              {title}
            </div>
          )} */}

          <div className="floor-indicator">
            {[1, 2, 3, 4, 5].map((id) => (
              <span
                key={id}
                className={`floor-indicator-item ${isIndicatorActive(id) ? 'active' : ''}`}
              >
                {id}
              </span>
            ))}
          </div>
        </header>

        <main className="elevator-stage">
          <div className={`doors ${doorsClosed ? 'closed' : 'open'}`} aria-hidden="true">
            <div className="door left">
              <img src="/door-left.png" alt="" />
            </div>
            <div className="door right">
              <img src="/door-right.png" alt="" />
            </div>
          </div>

          {lightBeam && <div className={`light-beam ${lightBeamClass}`} />}

          <section className="screen-content">
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
                      Чтобы подняться выше, подпишитесь на канал группы idst.
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
                  <div className={`panel-display panel-display-choice ${screen === 'home' ? 'panel-display-blink' : ''}`}>{title}</div>

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
                  Пассажиры, не осуществившие выбор, будут автоматически доставлены на последний этаж.
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
                    <div className="floor-badge">Этаж {selectedFloor.id}</div>
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
  <span>Кодовое слово</span>

  <input
    value={word}
    onChange={(e) => setWord(e.target.value)}
    placeholder="Введите слово"
    className="code-input"
  />

  <span className="code-hint code-hint-blink">
    Найди верное слово вам помогут видеошоты альбома на Яндекс Музыке.
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

        <footer className="footer-bar">
          <span>subscription mode</span>
          <span>{subscribed ? 'доступ открыт' : 'ожидание проверки'}</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
