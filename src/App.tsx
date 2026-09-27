import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BrowserProvider, Contract, formatUnits, getAddress, isAddress, parseUnits, type Eip1193Provider } from 'ethers'
import { ArrowDownToLine, ArrowUpRight, Check, ChevronDown, CircleAlert, Clock3, Copy, LoaderCircle, RefreshCw, ShieldCheck, Wallet } from 'lucide-react'
import './App.css'

const CONTRACT_ADDRESS = getAddress('0x9244d92243f019d70810aBcf28934FbB8558c60d')
const CONTRACT_ABI = [
  'function DIRECT_INCOME() view returns (uint256)',
  'function GOLD_RANK_TEAM() view returns (uint256)',
  'function ID_VALIDITY() view returns (uint256)',
  'function LEVEL_INCOME() view returns (uint256)',
  'function REGISTRATION_FEE() view returns (uint256)',
  'function STAR_RANK_TEAM() view returns (uint256)',
  'function getDashboardData(address) view returns (bool isRegistered, bool isActive, address referrer, uint256 expiryTime, uint256 daysRemaining, uint256 directReferrals, uint256 totalTeamSize, uint256 totalDirectIncome, uint256 totalLevelIncome, uint256 totalIncome, string rankName)',
  'function isUserActive(address) view returns (bool)',
  'function owner() view returns (address)',
  'function pgdToken() view returns (address)',
  'function register(address _referrer)',
  'function renewID()',
  'function totalUsers() view returns (uint256)',
  'function users(address) view returns (bool isRegistered, address referrer, uint256 registrationTime, uint256 expiryTime, uint256 directReferrals, uint256 totalTeamSize, uint256 totalDirectIncome, uint256 totalLevelIncome, uint8 currentRank)',
  'function withdrawContractPGD(uint256 _amount)',
] as const
const TOKEN_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      on?: (event: string, listener: (...args: unknown[]) => void) => void
    }
  }
}

type DashboardData = {
  isRegistered: boolean
  isActive: boolean
  referrer: string
  registrationTime: bigint
  expiryTime: bigint
  daysRemaining: bigint
  directReferrals: bigint
  totalTeamSize: bigint
  totalDirectIncome: bigint
  totalLevelIncome: bigint
  totalIncome: bigint
  rankName: string
}

type NetworkState = 'disconnected' | 'checking' | 'ready' | 'missing'

function App() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [account, setAccount] = useState('')
  const [chainId, setChainId] = useState('')
  const [networkState, setNetworkState] = useState<NetworkState>('disconnected')
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [totalUsers, setTotalUsers] = useState('—')
  const [registrationFee, setRegistrationFee] = useState<bigint>(0n)
  const [idValidity, setIdValidity] = useState<bigint>(0n)
  const [directIncomeRate, setDirectIncomeRate] = useState<bigint>(0n)
  const [levelIncomeRate, setLevelIncomeRate] = useState<bigint>(0n)
  const [goldRankTeam, setGoldRankTeam] = useState<bigint>(0n)
  const [starRankTeam, setStarRankTeam] = useState<bigint>(0n)
  const [tokenAddress, setTokenAddress] = useState('')
  const [tokenBalance, setTokenBalance] = useState<bigint>(0n)
  const [treasuryBalance, setTreasuryBalance] = useState<bigint>(0n)
  const [tokenDecimals, setTokenDecimals] = useState(18)
  const [tokenSymbol, setTokenSymbol] = useState('PGD')
  const [isOwner, setIsOwner] = useState(false)
  const [referrerInput, setReferrerInput] = useState('')
  const [withdrawInput, setWithdrawInput] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async (activeProvider: BrowserProvider, activeAccount: string) => {
    setNetworkState('checking')
    setError('')
    try {
      const network = await activeProvider.getNetwork()
      setChainId(network.chainId.toString())
      const code = await activeProvider.getCode(CONTRACT_ADDRESS)
      if (code === '0x') {
        setNetworkState('missing')
        setDashboard(null)
        setError(`Pagoda contract not found on chain ${network.chainId.toString()}. Switch to the deployment network in your wallet.`)
        return
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeProvider)
      const [data, userCount, fee, validity, directRate, levelRate, goldTeam, starTeam, ownerAddress, pgdAddress, activeStatus] = await Promise.all([
        contract.getDashboardData(activeAccount),
        contract.totalUsers(),
        contract.REGISTRATION_FEE(),
        contract.ID_VALIDITY(),
        contract.DIRECT_INCOME(),
        contract.LEVEL_INCOME(),
        contract.GOLD_RANK_TEAM(),
        contract.STAR_RANK_TEAM(),
        contract.owner(),
        contract.pgdToken(),
        contract.isUserActive(activeAccount),
      ])
      const pgd = new Contract(pgdAddress, TOKEN_ABI, activeProvider)
      const [decimalsValue, symbolValue, balance, treasury, userRecord] = await Promise.all([
        pgd.decimals(),
        pgd.symbol(),
        pgd.balanceOf(activeAccount),
        pgd.balanceOf(CONTRACT_ADDRESS),
        contract.users(activeAccount),
      ])
      const decimals = Number(decimalsValue)
      setDashboard({
        isRegistered: data.isRegistered,
        isActive: activeStatus,
        referrer: data.referrer,
        registrationTime: userRecord.registrationTime,
        expiryTime: data.expiryTime,
        daysRemaining: data.daysRemaining,
        directReferrals: data.directReferrals,
        totalTeamSize: data.totalTeamSize,
        totalDirectIncome: data.totalDirectIncome,
        totalLevelIncome: data.totalLevelIncome,
        totalIncome: data.totalIncome,
        rankName: data.rankName,
      })
      setTotalUsers(userCount.toString())
      setRegistrationFee(fee)
      setIdValidity(validity)
      setDirectIncomeRate(directRate)
      setLevelIncomeRate(levelRate)
      setGoldRankTeam(goldTeam)
      setStarRankTeam(starTeam)
      setTokenAddress(getAddress(pgdAddress))
      setTokenDecimals(decimals)
      setTokenSymbol(symbolValue)
      setTokenBalance(balance)
      setTreasuryBalance(treasury)
      setIsOwner(ownerAddress.toLowerCase() === activeAccount.toLowerCase())
      setNetworkState('ready')
    } catch (cause) {
      setNetworkState('missing')
      setError(readableError(cause))
    }
  }, [])

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError('No injected wallet found. Install MetaMask or another EVM wallet to continue.')
      return
    }
    setBusy('connect')
    setError('')
    try {
      const activeProvider = new BrowserProvider(window.ethereum)
      const signer = await activeProvider.getSigner()
      const activeAccount = await signer.getAddress()
      setProvider(activeProvider)
      setAccount(activeAccount)
      await loadDashboard(activeProvider, activeAccount)
    } catch (cause) {
      setError(readableError(cause))
    } finally {
      setBusy('')
    }
  }, [loadDashboard])

  useEffect(() => {
    if (!window.ethereum?.on) return
    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0]
      if (!Array.isArray(accounts) || typeof accounts[0] !== 'string') {
        setAccount('')
        setDashboard(null)
        setNetworkState('disconnected')
        return
      }
      setAccount(accounts[0])
      void connectWallet()
    }
    const handleChainChanged = () => {
      if (account) void connectWallet()
    }
    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)
  }, [account, connectWallet])

  const performFeeAction = async (event: { preventDefault: () => void }, kind: 'register' | 'renew') => {
    event.preventDefault()
    if (!provider || !account || networkState !== 'ready') return
    if (kind === 'register' && (!isAddress(referrerInput) || referrerInput.toLowerCase() === account.toLowerCase())) {
      setError('Enter a valid referrer address that is different from your connected wallet.')
      return
    }
    setBusy(kind)
    setError('')
    setMessage('')
    try {
      const signer = await provider.getSigner()
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      const token = new Contract(tokenAddress, TOKEN_ABI, signer)
      const allowance = await token.allowance(account, CONTRACT_ADDRESS)
      if (allowance < registrationFee) {
        setMessage(`Approve ${formatToken(registrationFee, tokenDecimals)} ${tokenSymbol} in your wallet to continue.`)
        const approval = await token.approve(CONTRACT_ADDRESS, registrationFee)
        await approval.wait()
      }
      setMessage(kind === 'register' ? 'Registration transaction is awaiting confirmation.' : 'Renewal transaction is awaiting confirmation.')
      const transaction = kind === 'register'
        ? await contract.register(getAddress(referrerInput))
        : await contract.renewID()
      await transaction.wait()
      setMessage(kind === 'register' ? 'Registration complete.' : 'ID renewed successfully.')
      await loadDashboard(provider, account)
    } catch (cause) {
      setError(readableError(cause))
    } finally {
      setBusy('')
    }
  }

  const withdraw = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!provider || !account || networkState !== 'ready' || !isOwner) return
    let amount: bigint
    try {
      amount = parseUnits(withdrawInput, tokenDecimals)
      if (amount <= 0n) throw new Error('Enter an amount greater than zero.')
    } catch (cause) {
      setError(readableError(cause))
      return
    }
    setBusy('withdraw')
    setError('')
    setMessage('')
    try {
      const signer = await provider.getSigner()
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      const transaction = await contract.withdrawContractPGD(amount)
      setMessage('Withdrawal transaction is awaiting confirmation.')
      await transaction.wait()
      setMessage(`${formatToken(amount, tokenDecimals)} ${tokenSymbol} withdrawn from the contract.`)
      setWithdrawInput('')
      await loadDashboard(provider, account)
    } catch (cause) {
      setError(readableError(cause))
    } finally {
      setBusy('')
    }
  }

  const refresh = () => {
    if (provider && account) void loadDashboard(provider, account)
  }

  const active = networkState === 'ready'
  const feeText = active ? formatToken(registrationFee, tokenDecimals) : '—'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Pagoda home">
          <span className="brand-mark">P</span>
          <span>pagoda<span className="brand-period">.</span></span>
        </a>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#overview"><span className="nav-glyph">01</span>Overview</a>
          <a className="nav-link" href="#membership"><span className="nav-glyph">02</span>Membership</a>
          <a className="nav-link" href="#team"><span className="nav-glyph">03</span>My network</a>
          {isOwner && <a className="nav-link" href="#admin"><span className="nav-glyph">04</span>Admin</a>}
        </nav>
        <div className="sidebar-foot">
          <span className={`connection-dot ${active ? 'is-live' : ''}`} />
          <span>{active ? `Chain ${chainId}` : 'Wallet not connected'}</span>
          <span className="sidebar-foot-mark">PGD</span>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>Pagoda</span><span className="crumb-slash">/</span><strong>Overview</strong></div>
          <div className="topbar-actions">
            {account ? (
              <>
                <button className="icon-button" type="button" onClick={refresh} disabled={networkState === 'checking'} title="Refresh dashboard" aria-label="Refresh dashboard">
                  <RefreshCw size={16} className={networkState === 'checking' ? 'spin' : ''} />
                </button>
                <button className="wallet-chip" type="button" onClick={() => void navigator.clipboard?.writeText(account)} title="Copy wallet address">
                  <span className="wallet-live" />{shortAddress(account)}<Copy size={13} />
                </button>
              </>
            ) : (
              <button className="button button-dark connect-button" type="button" onClick={() => void connectWallet()} disabled={busy === 'connect'}>
                {busy === 'connect' ? <LoaderCircle size={16} className="spin" /> : <Wallet size={16} />}
                Connect wallet
              </button>
            )}
          </div>
        </header>

        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" />MEMBER PORTAL</div>
            <h1>Your Pagoda <em>at a glance.</em></h1>
            <p className="heading-subtitle">A clear view of your membership, network, and PGD income.</p>
          </div>
          <div className="heading-status">
            <span className={`status-mark ${dashboard?.isActive ? 'status-active' : ''}`} />
            <div><strong>{dashboard?.isActive ? 'Membership active' : dashboard?.isRegistered ? 'Membership expired' : 'Membership not started'}</strong><span>{account ? `Wallet ${shortAddress(account)}` : 'Connect your wallet to view your account'}</span></div>
          </div>
        </section>

        {error && <div className="notice notice-error" role="alert"><CircleAlert size={17} /><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
        {message && <div className="notice notice-success" role="status"><Check size={17} /><span>{message}</span><button type="button" onClick={() => setMessage('')} aria-label="Dismiss message">×</button></div>}

        <section className="metrics-grid" aria-label="Account summary">
          <article className="metric-card metric-primary">
            <div className="metric-label">TOTAL INCOME <span className="metric-corner">01</span></div>
            <div className="metric-value">{dashboard ? formatToken(dashboard.totalIncome, tokenDecimals) : '—'} <span>{tokenSymbol}</span></div>
            <div className="metric-foot"><span className="metric-indicator" />Lifetime earnings</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">DIRECT INCOME <span className="metric-corner">02</span></div>
            <div className="metric-value">{dashboard ? formatToken(dashboard.totalDirectIncome, tokenDecimals) : '—'} <span>{tokenSymbol}</span></div>
            <div className="metric-foot">Personal referrals</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">LEVEL INCOME <span className="metric-corner">03</span></div>
            <div className="metric-value">{dashboard ? formatToken(dashboard.totalLevelIncome, tokenDecimals) : '—'} <span>{tokenSymbol}</span></div>
            <div className="metric-foot">Network commissions</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">TEAM SIZE <span className="metric-corner">04</span></div>
            <div className="metric-value">{dashboard ? dashboard.totalTeamSize.toString() : '—'} <span>members</span></div>
            <div className="metric-foot">{dashboard?.directReferrals.toString() ?? '—'} direct referrals</div>
          </article>
        </section>

        <div className="content-grid">
          <section className="panel membership-panel" id="membership">
            <div className="panel-heading">
              <div><div className="section-kicker">MEMBERSHIP</div><h2>Account status</h2></div>
              <button className="icon-button panel-refresh" type="button" onClick={refresh} disabled={!account || networkState === 'checking'} title="Refresh account data" aria-label="Refresh account data"><RefreshCw size={15} className={networkState === 'checking' ? 'spin' : ''} /></button>
            </div>
            <div className="member-summary">
              <div className="rank-emblem"><ShieldCheck size={23} strokeWidth={1.5} /></div>
              <div><div className="member-rank">{dashboard?.rankName || 'Unranked'}</div><div className="member-caption">CURRENT RANK</div></div>
              <span className={`member-state ${dashboard?.isActive ? 'is-active' : ''}`}>{dashboard?.isActive ? 'Active' : dashboard?.isRegistered ? 'Expired' : 'Not registered'}</span>
            </div>
            <div className="detail-list">
              <div className="detail-row"><span>Referrer</span><span className="detail-value mono">{dashboard?.referrer && dashboard.referrer !== '0x0000000000000000000000000000000000000000' ? shortAddress(dashboard.referrer) : '—'}</span></div>
              <div className="detail-row"><span>Registered</span><span className="detail-value">{dashboard?.registrationTime && dashboard.registrationTime > 0n ? formatDate(dashboard.registrationTime) : '—'}</span></div>
              <div className="detail-row"><span>Membership expires</span><span className="detail-value">{dashboard?.expiryTime && dashboard.expiryTime > 0n ? formatDate(dashboard.expiryTime) : '—'}</span></div>
              <div className="detail-row"><span>Time remaining</span><span className="detail-value"><Clock3 size={14} />{dashboard?.isActive ? `${dashboard.daysRemaining.toString()} days` : '—'}</span></div>
              <div className="detail-row"><span>PGD wallet balance</span><span className="detail-value">{dashboard ? formatToken(tokenBalance, tokenDecimals) : '—'} {tokenSymbol}</span></div>
            </div>
            <div className="membership-actions">
              {!dashboard?.isRegistered ? (
                <form onSubmit={(event) => void performFeeAction(event, 'register')} className="action-form">
                  <label htmlFor="referrer">Referrer wallet address</label>
                  <input id="referrer" value={referrerInput} onChange={(event) => setReferrerInput(event.target.value)} placeholder="0x..." spellCheck={false} autoComplete="off" />
                  <div className="fee-line"><span>Registration fee</span><strong>{feeText} {tokenSymbol}</strong></div>
                  <button className="button button-green full-button" type="submit" disabled={!active || busy !== ''}>{busy === 'register' ? <LoaderCircle size={16} className="spin" /> : <ArrowUpRight size={16} />}<span className="button-label-strong">Register</span></button>
                </form>
              ) : (
                <div className="renew-block">
                  <div className="fee-line"><span>Renewal fee</span><strong>{feeText} {tokenSymbol}</strong></div>
                  <button className="button button-green full-button" type="button" onClick={(event) => void performFeeAction(event, 'renew')} disabled={!active || busy !== ''}>{busy === 'renew' ? <LoaderCircle size={16} className="spin" /> : <ArrowUpRight size={16} />}Renew ID</button>
                </div>
              )}
              <p className="action-note">Token approval is requested only when your allowance is below the required fee.</p>
            </div>
          </section>

          <section className="panel network-panel" id="team">
            <div className="panel-heading">
              <div><div className="section-kicker">NETWORK OVERVIEW</div><h2>Your growth</h2></div>
              <span className="panel-index">PGD / 01</span>
            </div>
            <div className="team-total"><span className="team-number">{dashboard ? dashboard.totalTeamSize.toString() : '—'}</span><span className="team-unit">people<br />in your network</span></div>
            <div className="team-rule"><span /></div>
            <div className="network-stats">
              <div className="network-stat"><span>Direct referrals</span><strong>{dashboard ? dashboard.directReferrals.toString() : '—'}</strong></div>
              <div className="network-stat"><span>All platform members</span><strong>{totalUsers}</strong></div>
              <div className="network-stat"><span>Account rank</span><strong>{dashboard?.rankName || '—'}</strong></div>
              <div className="network-stat"><span>Contract status</span><strong className={active ? 'text-live' : ''}>{networkState === 'checking' ? 'Checking' : active ? 'Connected' : networkState === 'missing' ? 'Unavailable' : 'Disconnected'}</strong></div>
            </div>
            <div className="network-note"><span className="note-mark">i</span><span>Team and income totals are read from the Pagoda smart contract.</span></div>
          </section>
        </div>

        <section className="income-section">
          <div className="income-heading"><div><div className="section-kicker">PROGRAM DETAILS</div><h2>Income structure</h2></div><span>Values returned by the contract</span></div>
          <div className="income-table-wrap">
            <table className="income-table">
              <thead><tr><th>PROGRAM</th><th>CONTRACT VALUE</th><th>YOUR EARNINGS</th><th>STATUS</th></tr></thead>
              <tbody>
                <tr><td><span className="table-marker marker-green" />Direct income</td><td>{formatToken(directIncomeRate, tokenDecimals)} {tokenSymbol}</td><td>{dashboard ? formatToken(dashboard.totalDirectIncome, tokenDecimals) : '—'} {tokenSymbol}</td><td><span className="table-status">ON-CHAIN</span></td></tr>
                <tr><td><span className="table-marker marker-blue" />Level income</td><td>{formatToken(levelIncomeRate, tokenDecimals)} {tokenSymbol}</td><td>{dashboard ? formatToken(dashboard.totalLevelIncome, tokenDecimals) : '—'} {tokenSymbol}</td><td><span className="table-status">ON-CHAIN</span></td></tr>
                <tr><td><span className="table-marker marker-orange" />Gold rank team</td><td>{formatToken(goldRankTeam, tokenDecimals)} {tokenSymbol}</td><td>—</td><td><span className="table-status">RANK POOL</span></td></tr>
                <tr><td><span className="table-marker marker-violet" />Star rank team</td><td>{formatToken(starRankTeam, tokenDecimals)} {tokenSymbol}</td><td>—</td><td><span className="table-status">RANK POOL</span></td></tr>
              </tbody>
            </table>
          </div>
          <div className="income-footnote">Membership validity: <strong>{Math.floor(Number(idValidity) / 86400)} days</strong><span className="income-foot-separator">/</span>Registration fee: <strong>{feeText} {tokenSymbol}</strong></div>
        </section>

        {isOwner && <section className="panel admin-panel" id="admin">
          <div className="panel-heading"><div><div className="section-kicker">OWNER CONTROLS</div><h2>Contract treasury</h2></div><span className="owner-badge"><ShieldCheck size={14} />OWNER ACCESS</span></div>
          <p className="admin-copy">Withdraw PGD tokens held by the Pagoda contract. This action is restricted to the contract owner.</p>
          <div className="treasury-balance"><span>AVAILABLE TREASURY BALANCE</span><strong>{formatToken(treasuryBalance, tokenDecimals)} {tokenSymbol}</strong></div>
          <form className="withdraw-form" onSubmit={(event) => void withdraw(event)}>
            <label className="withdraw-input-wrap" htmlFor="withdraw-amount"><span>AMOUNT</span><input id="withdraw-amount" inputMode="decimal" value={withdrawInput} onChange={(event) => setWithdrawInput(event.target.value)} placeholder="0.00" /><strong>{tokenSymbol}</strong></label>
            <button className="button button-dark" type="submit" disabled={!active || busy !== ''}>{busy === 'withdraw' ? <LoaderCircle size={16} className="spin" /> : <ArrowDownToLine size={16} />}Withdraw PGD</button>
          </form>
        </section>}

        <footer className="app-footer"><div><span className="footer-mark">P.</span> PAGODA MEMBER PORTAL</div><div className="footer-contract">CONTRACT <span>{shortAddress(CONTRACT_ADDRESS)}</span></div><div className="footer-right">CONNECTED WALLET ONLY <ChevronDown size={13} /></div></footer>
      </main>
    </div>
  )
}

function formatToken(amount: bigint, decimals: number) {
  const [whole = '0', fractional = ''] = formatUnits(amount, decimals).split('.')
  const fraction = fractional.slice(0, 4).replace(/0+$/, '')
  return `${BigInt(whole).toLocaleString('en-US')}${fraction ? `.${fraction}` : ''}`
}

function formatDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function readableError(cause: unknown) {
  if (cause && typeof cause === 'object' && 'shortMessage' in cause && typeof cause.shortMessage === 'string') return cause.shortMessage
  if (cause instanceof Error) return cause.message
  return 'The request could not be completed. Check your wallet and try again.'
}

export default App
