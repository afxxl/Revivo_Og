
window.addEventListener('load', function() {
    // Mobile menu toggle
    const burgerMenu = document.getElementById('burger-menu');
    if (burgerMenu) {
      burgerMenu.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu) {
          mobileMenu.classList.toggle('open');
          // Toggle aria-expanded for accessibility
          const expanded = mobileMenu.classList.contains('open');
          burgerMenu.setAttribute('aria-expanded', expanded);
          
          // Update burger icon to X when menu is open
          if (expanded) {
            burgerMenu.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"></path>
            </svg>`;
          } else {
            burgerMenu.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>`;
          }
        }
      });
      
      // Close mobile menu when clicking outside
      document.addEventListener('click', function(e) {
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu && mobileMenu.classList.contains('open') && !mobileMenu.contains(e.target) && e.target !== burgerMenu && !burgerMenu.contains(e.target)) {
          mobileMenu.classList.remove('open');
          burgerMenu.setAttribute('aria-expanded', 'false');
          burgerMenu.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>`;
        }
      });
    }

    // Desktop dropdown toggle
    document.addEventListener('click', function(event) {
      const dropdownBtn = event.target.closest('.dropdown > button');
      if (dropdownBtn) {
        event.preventDefault();
        const dropdown = dropdownBtn.parentElement;
        const dropdownContent = dropdown.querySelector('.dropdown-content');
        
        // Close other dropdowns
        document.querySelectorAll('.dropdown-content').forEach(content => {
          if (content !== dropdownContent) {
            content.style.display = 'none';
          }
        });
        
        // Toggle current dropdown
        const isVisible = dropdownContent.style.display === 'block';
        dropdownContent.style.display = isVisible ? 'none' : 'block';
        dropdownBtn.setAttribute('aria-expanded', !isVisible);
      } else if (!event.target.closest('.dropdown') && !event.target.closest('a[href="/logout"]')) {
        // Close all dropdowns when clicking outside
        document.querySelectorAll('.dropdown-content').forEach(content => {
          content.style.display = 'none';
        });
      }
    });

    window.addEventListener('scroll', function() {
      const header = document.getElementById('mainHeader');
      if (header) {
        if (window.scrollY > 0) {
          header.classList.add('bg-white');
          header.classList.remove('bg-transparent');
        } else {
          header.classList.remove('bg-white');
          header.classList.add('bg-transparent');
        }
      }
    });

    async function checkSession() {
      try {
        const response = await fetch('/api/check-session');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        const { loggedIn, user, isBlocked } = data;
        const authSection = document.getElementById('auth-state');
        
        if (isBlocked) {
          showBlockedMessage();
          setTimeout(() => {
            window.location.href = '/login';
          }, 5000);
          return;
        }
        
        if (authSection) {
          const serverLoggedIn = loggedIn;
          const clientLoggedIn = !!authSection.querySelector('.dropdown');
          
          if (serverLoggedIn !== clientLoggedIn) {
            if (serverLoggedIn) {
              authSection.innerHTML = `
                <div class="dropdown"> 
                  <button class="nav-link flex items-center gap-1">
                    ${user.name}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  <div class="dropdown-content" style="display: none">
                    <div class="dropdown-header">
                      <div class="user-name">${user.name}</div>
                      <div class="user-email">${user.email}</div>
                    </div>
                    <a href="/profile">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                      </svg>
                      Profile
                    </a>
                    <a href="/profile#orders">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                      </svg>
                      Orders
                    </a>
                    <a href="/wishlist">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                      </svg>
                      Wishlist
                    </a>
                    <a href="/wallet">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/>
                      </svg>
                      Wallet
                    </a>
                    <a href="#" id="referralMenuLink" class="relative">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"/>
                      </svg>
                      Referrals
                      <span class="absolute top-0 right-0 h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                    </a>
                    <a href="/logout" class="logout-link">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                      </svg>
                      Logout
                    </a>
                  </div>
                </div>
              `;
            } else {
              authSection.innerHTML = '<a href="/login" class="nav-link">LOGIN</a>';
              if (window.location.pathname !== '/login') {
                window.location.reload();
              }
            }
          }
        }
      } catch (error) {
        console.error('Session check failed:', error);
        // showToast('Failed to verify session. Please refresh the page.', 'error');
      }
    }

    async function handleLogout() {
      try {
        const response = await fetch('/logout', {
          method: 'GET',
          credentials: 'include', // Ensure cookies are sent
        });
        if (!response.ok) throw new Error('Logout request failed');

        localStorage.clear();
        const authSection = document.getElementById('auth-state');
        if (authSection) {
          authSection.innerHTML = '<a href="/login" class="nav-link">LOGIN</a>';
        }

        await checkSession();
        window.location.assign('/');
      } catch (error) {
        console.error('Logout failed:', error);
        showToast('Failed to log out. Please try again.', 'error');
      }
    }

    document.addEventListener('click', function(event) {
      const logoutLink = event.target.closest('a[href="/logout"]');
      if (logoutLink) {
        event.preventDefault();
        handleLogout();
      }
    });

    function showBlockedMessage() {
      
      const blockedModal = document.createElement('div');
      blockedModal.id = 'blockedModal';
      blockedModal.className = 'fixed inset-0 flex items-center justify-center z-[9999] bg-black bg-opacity-50';
      blockedModal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-md mx-4 overflow-hidden animate-bounce-in">
          <div class="bg-red-600 p-4">
            <div class="flex items-center">
              <svg class="w-8 h-8 text-white mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <h3 class="text-xl font-bold text-white">Account Blocked</h3>
            </div>
          </div>
          <div class="p-6">
            <p class="text-gray-700 mb-4">Your account has been blocked by the administrator. You will be redirected to the login page.</p>
            <div class="flex justify-end">
              <button id="blockedOkBtn" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
                OK
              </button>
            </div>
          </div>
        </div>
      `;
      
      // Add animation styles
      const style = document.createElement('style');
      style.textContent = `
        @keyframes bounceIn {
          from, 20%, 40%, 60%, 80%, to { animation-timing-function: cubic-bezier(0.215, 0.610, 0.355, 1.000); }
          0% { opacity: 0; transform: scale3d(0.3, 0.3, 0.3); }
          20% { transform: scale3d(1.1, 1.1, 1.1); }
          40% { transform: scale3d(0.9, 0.9, 0.9); }
          60% { opacity: 1; transform: scale3d(1.03, 1.03, 1.03); }
          80% { transform: scale3d(0.97, 0.97, 0.97); }
          to { opacity: 1; transform: scale3d(1, 1, 1); }
        }
        .animate-bounce-in {
          animation: bounceIn 0.75s;
        }
      `;
      document.head.appendChild(style);
      
      // Add to DOM
      document.body.appendChild(blockedModal);
      
      // Add event listener to the OK button
      document.getElementById('blockedOkBtn').addEventListener('click', function() {
        window.location.href = '/login';
      });
      
      // Auto redirect after delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 5000);
    }

    function showToast(message, type = 'success') {
      const toast = document.createElement('div');
      toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-white ${
        type === 'success' ? 'bg-green-600' : 'bg-red-600'
      } transition-opacity duration-300 z-50`;
      toast.innerHTML = message;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    checkSession();
    
    // Check session more frequently (every 2 seconds) to detect blocked status faster
    const sessionCheckInterval = setInterval(checkSession, 2000);
    
    // Clear interval when page is unloaded to prevent memory leaks
    window.addEventListener('beforeunload', () => {
      clearInterval(sessionCheckInterval);
    });

  // Referral modal and functionality
  const referralModal = document.createElement('div');
  referralModal.id = 'referralModal';
  referralModal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center hidden';
  referralModal.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
      <div class="p-6 border-b border-gray-200">
        <div class="flex justify-between items-center">
          <h3 class="text-xl font-medium text-[#2C2C2C]">Your Referral Program</h3>
          <button id="closeReferralModal" class="text-gray-400 hover:text-gray-500">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="p-6 max-h-[70vh] overflow-y-auto">
        <div id="referralLoading" class="text-center py-8">
          <svg class="animate-spin h-8 w-8 text-[#2C2C2C] mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="mt-2 text-[#2C2C2C]/70">Loading your referral details...</p>
        </div>
        
        <div id="referralContent" class="hidden">
          <div class="flex items-center justify-between mb-4">
            <div class="text-sm text-[#2C2C2C]/70">Your Referral Code</div>
            <div class="flex items-center gap-2">
              <button id="shareReferralBtn" class="text-xs bg-[#2C2C2C] text-white px-2 py-1 rounded">
                <i class="fas fa-share-alt mr-1"></i> Share
              </button>
            </div>
          </div>
          
          <div class="bg-gray-50 p-3 rounded-lg mb-6 flex items-center justify-between">
            <span id="referralCodeDisplay" class="font-mono text-lg font-semibold tracking-wide"></span>
            <button id="copyReferralBtn" class="text-xs bg-[#2C2C2C] text-white px-2 py-1 rounded">
              <i class="fas fa-copy mr-1"></i> Copy
            </button>
          </div>
          
          <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-green-50 p-4 rounded-lg text-center">
              <div class="text-xl font-semibold text-green-600" id="referralEarnings">₹0</div>
              <div class="text-xs text-[#2C2C2C]/70 mt-1">Total Earnings</div>
            </div>
            <div class="bg-blue-50 p-4 rounded-lg text-center">
              <div class="text-xl font-semibold text-blue-600" id="referralCount">0</div>
              <div class="text-xs text-[#2C2C2C]/70 mt-1">People Referred</div>
            </div>
          </div>
          
          <div class="mb-4">
            <div class="text-sm font-medium text-[#2C2C2C] mb-3">How It Works</div>
            <div class="space-y-2 text-sm">
              <p class="flex items-start gap-2">
                <span class="text-green-500 mt-0.5"><i class="fas fa-check-circle"></i></span>
                <span>Share your referral code with friends</span>
              </p>
              <p class="flex items-start gap-2">
                <span class="text-green-500 mt-0.5"><i class="fas fa-check-circle"></i></span>
                <span>When they sign up using your code, you get ₹100</span>
              </p>
              <p class="flex items-start gap-2">
                <span class="text-green-500 mt-0.5"><i class="fas fa-check-circle"></i></span>
                <span>They also get ₹50 in their wallet</span>
              </p>
            </div>
          </div>
          
          <div id="referredUsersSection" class="hidden">
            <div class="text-sm font-medium text-[#2C2C2C] mb-3 mt-6">People You've Referred</div>
            <div class="space-y-3 max-h-60 overflow-y-auto" id="referredUsersList">
              <!-- Referred users will be populated here -->
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(referralModal);
  
  // Referral Modal Handling
  document.addEventListener('click', function(e) {
    const referralMenuLink = e.target.closest('#referralMenuLink, #mobilReferralMenuLink');
    if (referralMenuLink) {
      e.preventDefault();
      
      // Close dropdown
      document.querySelectorAll('.dropdown-content').forEach(content => {
        content.style.display = 'none';
      });
      
      // Close mobile menu if open
      const mobileMenu = document.getElementById('mobile-menu');
      if (mobileMenu && mobileMenu.classList.contains('open')) {
        mobileMenu.classList.remove('open');
      }
      
      // Show modal and fetch data
      referralModal.classList.remove('hidden');
      document.getElementById('referralLoading').classList.remove('hidden');
      document.getElementById('referralContent').classList.add('hidden');
      
      fetchReferralStats();
    }
  });
  
  document.getElementById('closeReferralModal')?.addEventListener('click', function() {
    referralModal.classList.add('hidden');
  });
  
  // Close modal when clicking outside
  referralModal.addEventListener('click', function(e) {
    if (e.target === referralModal) {
      referralModal.classList.add('hidden');
    }
  });
  
  async function fetchReferralStats() {
    try {
      const response = await fetch('/api/referral-stats');
      if (!response.ok) throw new Error('Network response was not ok');
      
      const { success, data } = await response.json();
      
      if (success && data) {
        // Update UI with referral data
        document.getElementById('referralCodeDisplay').textContent = data.referralCode || 'No referral code available';
        document.getElementById('referralEarnings').textContent = `₹${data.totalEarnings}`;
        document.getElementById('referralCount').textContent = data.referralCount;
        
        // Show referred users if any
        const referredUsersSection = document.getElementById('referredUsersSection');
        const referredUsersList = document.getElementById('referredUsersList');
        
        if (data.referredUsers && data.referredUsers.length > 0) {
          referredUsersSection.classList.remove('hidden');
          referredUsersList.innerHTML = '';
          
          data.referredUsers.forEach(user => {
            const date = new Date(user.createdAt).toLocaleDateString();
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between bg-gray-50 p-3 rounded';
            item.innerHTML = `
              <div>
                <div class="font-medium text-sm">${user.name}</div>
                <div class="text-xs text-[#2C2C2C]/70">${user.email}</div>
              </div>
              <div class="text-xs text-[#2C2C2C]/70">${date}</div>
            `;
            referredUsersList.appendChild(item);
          });
        } else {
          referredUsersSection.classList.add('hidden');
        }
        
        // Show content and hide loading
        document.getElementById('referralLoading').classList.add('hidden');
        document.getElementById('referralContent').classList.remove('hidden');
        
        // Set up copy button
        const copyBtn = document.getElementById('copyReferralBtn');
        copyBtn.addEventListener('click', function() {
          const code = document.getElementById('referralCodeDisplay').textContent;
          navigator.clipboard.writeText(code)
            .then(() => {
              showToast('Referral code copied to clipboard!', 'success');
            })
            .catch(err => {
              console.error('Failed to copy: ', err);
              showToast('Failed to copy code', 'error');
            });
        });
        
        // Set up share button
        const shareBtn = document.getElementById('shareReferralBtn');
        shareBtn.addEventListener('click', function() {
          const code = document.getElementById('referralCodeDisplay').textContent;
          const shareText = `Sign up on REVIVO using my referral code "${code}" and get ₹50 in your wallet! I'll get ₹100 too! 🎁 Join here: ${window.location.origin}/signup`;
          
          if (navigator.share) {
            navigator.share({
              title: 'Join REVIVO with my referral code!',
              text: shareText,
              url: `${window.location.origin}/signup`
            })
            .then(() => showToast('Thanks for sharing!', 'success'))
            .catch(error => console.log('Error sharing:', error));
          } else {
            navigator.clipboard.writeText(shareText)
              .then(() => {
                showToast('Share text copied to clipboard!', 'success');
              })
              .catch(err => {
                console.error('Failed to copy: ', err);
                showToast('Failed to copy share text', 'error');
              });
          }
        });
      }
    } catch (error) {
      console.error('Error fetching referral stats:', error);
      document.getElementById('referralLoading').innerHTML = `
        <div class="text-center">
          <svg class="w-12 h-12 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <p class="mt-2 text-[#2C2C2C]">Failed to load referral data</p>
          <button id="retryReferralBtn" class="mt-3 text-sm bg-[#2C2C2C] text-white px-3 py-1 rounded">Retry</button>
        </div>
      `;
      
      document.getElementById('retryReferralBtn')?.addEventListener('click', fetchReferralStats);
    }
  }

  function calculateBestOfferPrice(salesPrice, productOffer, categoryOffer) {
    const productOfferAmount = salesPrice * (productOffer / 100);
    const categoryOfferAmount = salesPrice * (categoryOffer / 100);
    
    const bestOfferAmount = Math.max(productOfferAmount, categoryOfferAmount);
    
    if (bestOfferAmount > 0) {
      return (salesPrice - bestOfferAmount).toFixed(2);
    }
    
    return salesPrice.toFixed(2);
  }

  function getBestOfferPercentage(productOffer, categoryOffer) {
    return Math.max(productOffer || 0, categoryOffer || 0);
  }
});

