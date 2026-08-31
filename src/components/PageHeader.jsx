function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div className="page-header-main">
        <div className="page-eyebrow">
          {eyebrow}
        </div>

        <h1 className="page-title">
          {title}
        </h1>

        <p className="page-description">
          {description}
        </p>
      </div>

      {actions && (
        <div className="page-header-actions">
          {actions}
        </div>
      )}
    </div>
  )
}

export default PageHeader