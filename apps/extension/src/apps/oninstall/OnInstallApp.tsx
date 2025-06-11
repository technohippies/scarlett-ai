import { createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { setAuthToken, getAuthToken, setInstallationState, getInstallationState } from '../../utils/storage';

export const OnInstallApp: Component = () => {
  const [status, setStatus] = createSignal<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = createSignal<string | null>(null);

  const setupDemoAccount = async () => {
    try {
      // Use the hardcoded demo token
      const demoToken = 'scarlett_test_demo_user_12345';
      
      // Store token
      await setAuthToken(demoToken);
      await setInstallationState({
        completed: true,
        jwtVerified: true,
        timestamp: Date.now(),
      });

      console.log('[OnInstall] Demo account setup complete');
      setStatus('success');
      
      // Wait a moment to show success
      setTimeout(() => {
        window.close();
      }, 2500);
      
    } catch (e: any) {
      console.error('[OnInstall] Setup failed:', e);
      setError(e.message || 'Failed to set up extension');
      setStatus('error');
    }
  };

  // Check for existing installation on mount
  onMount(async () => {
    const existingToken = await getAuthToken();
    const state = await getInstallationState();
    
    if (existingToken && state?.completed) {
      console.log('[OnInstall] Already installed, closing window');
      window.close();
      return;
    }
    
    // Add a small delay for better UX
    setTimeout(() => {
      setupDemoAccount();
    }, 1000);
  });

  return (
    <div style={{
      "min-height": "100vh",
      "background": "linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%)",
      "display": "flex",
      "align-items": "center",
      "justify-content": "center",
      "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <div style={{
        "text-align": "center",
        "padding": "60px",
        "max-width": "800px"
      }}>
        {/* Logo */}
        <div style={{
          "font-size": "120px",
          "margin-bottom": "40px",
          "filter": "drop-shadow(0 0 30px rgba(139, 92, 246, 0.5))"
        }}>
          🎤
        </div>

        {/* Title */}
        <h1 style={{
          "font-size": "72px",
          "font-weight": "800",
          "margin": "0 0 20px 0",
          "background": "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
          "background-clip": "text",
          "-webkit-background-clip": "text",
          "-webkit-text-fill-color": "transparent",
          "letter-spacing": "-2px"
        }}>
          Scarlett
        </h1>

        <p style={{
          "font-size": "24px",
          "color": "#a8a8a8",
          "margin-bottom": "60px",
          "font-weight": "300"
        }}>
          AI Karaoke for SoundCloud
        </p>

        {/* Status */}
        {status() === 'loading' && (
          <div>
            <div style={{
              "width": "80px",
              "height": "80px",
              "border": "4px solid rgba(139, 92, 246, 0.2)",
              "border-top-color": "#8b5cf6",
              "border-radius": "50%",
              "margin": "0 auto 30px",
              "animation": "spin 1s linear infinite"
            }} />
            <p style={{
              "font-size": "20px",
              "color": "#a8a8a8"
            }}>
              Setting up your account...
            </p>
          </div>
        )}

        {status() === 'success' && (
          <div>
            <div style={{
              "font-size": "100px",
              "margin-bottom": "30px",
              "animation": "bounce 0.5s ease-out"
            }}>
              ✨
            </div>
            <h2 style={{
              "font-size": "36px",
              "font-weight": "600",
              "color": "#fafafa",
              "margin-bottom": "20px"
            }}>
              All Set!
            </h2>
            <p style={{
              "font-size": "20px",
              "color": "#a8a8a8"
            }}>
              Extension ready. This window will close automatically...
            </p>
          </div>
        )}

        {status() === 'error' && (
          <div>
            <div style={{
              "font-size": "80px",
              "margin-bottom": "30px",
              "opacity": "0.5"
            }}>
              ⚠️
            </div>
            <p style={{
              "font-size": "20px",
              "color": "#ef4444",
              "margin-bottom": "30px"
            }}>
              {error()}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                "padding": "12px 32px",
                "font-size": "18px",
                "background": "rgba(139, 92, 246, 0.1)",
                "border": "1px solid rgba(139, 92, 246, 0.3)",
                "border-radius": "8px",
                "color": "#8b5cf6",
                "cursor": "pointer",
                "transition": "all 0.2s"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "rgba(139, 92, 246, 0.2)";
                e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.5)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "rgba(139, 92, 246, 0.1)";
                e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes bounce {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};