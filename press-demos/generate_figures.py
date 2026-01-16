"""Generate interactive Plotly figures for Press demo articles."""

import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly.express as px


def create_clt_dice_figure():
    """Create interactive CLT visualization with dice rolls."""
    np.random.seed(42)
    n_simulations = 10000

    # Pre-compute distributions for different numbers of dice
    frames = []
    steps = []

    for n_dice in range(1, 21):
        # Simulate rolling n_dice and taking the mean
        rolls = np.random.randint(1, 7, size=(n_simulations, n_dice))
        means = rolls.mean(axis=1)

        # Create histogram
        hist, bin_edges = np.histogram(means, bins=50, density=True)
        bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2

        frames.append(go.Frame(
            data=[go.Bar(x=bin_centers, y=hist, marker_color='steelblue', opacity=0.7)],
            name=str(n_dice)
        ))

        steps.append({
            "args": [[str(n_dice)], {"frame": {"duration": 300}, "mode": "immediate"}],
            "label": str(n_dice),
            "method": "animate"
        })

    # Initial frame (1 die)
    rolls = np.random.randint(1, 7, size=(n_simulations, 1))
    means = rolls.mean(axis=1)
    hist, bin_edges = np.histogram(means, bins=50, density=True)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2

    # Add normal distribution overlay for reference
    x_norm = np.linspace(1, 6, 100)
    mu, sigma = 3.5, np.sqrt(35/12)  # Mean and std of single die

    fig = go.Figure(
        data=[go.Bar(x=bin_centers, y=hist, marker_color='steelblue', opacity=0.7,
                     name='Sample means')],
        frames=frames,
        layout=go.Layout(
            title="Distribution of Dice Roll Averages",
            xaxis=dict(title="Mean Value", range=[0.5, 6.5]),
            yaxis=dict(title="Density", range=[0, 2.5]),
            sliders=[{
                "active": 0,
                "steps": steps,
                "currentvalue": {"prefix": "Number of dice: "},
                "pad": {"t": 50}
            }],
            template="plotly_white",
            showlegend=False
        )
    )

    return fig


def create_merge_sort_figure():
    """Create merge sort visualization."""
    # Show the recursive structure with a specific example
    original = [38, 27, 43, 3, 9, 82, 10]
    n = len(original)

    # Create figure showing the tree structure
    fig = go.Figure()

    # Levels of recursion
    levels = [
        [[38, 27, 43, 3, 9, 82, 10]],  # Level 0
        [[38, 27, 43, 3], [9, 82, 10]],  # Level 1
        [[38, 27], [43, 3], [9, 82], [10]],  # Level 2
        [[38], [27], [43], [3], [9], [82], [10]],  # Level 3 (base)
        [[27, 38], [3, 43], [9, 82], [10]],  # Level 4 (merge)
        [[3, 27, 38, 43], [9, 10, 82]],  # Level 5
        [[3, 9, 10, 27, 38, 43, 82]]  # Level 6 (sorted)
    ]

    labels = ["Divide", "Divide", "Divide", "Base Case", "Merge", "Merge", "Sorted!"]
    colors = px.colors.sequential.Viridis

    y_positions = [6, 5, 4, 3, 2, 1, 0]

    for level_idx, (level, label) in enumerate(zip(levels, labels)):
        # Calculate x positions for this level
        total_width = 10
        n_groups = len(level)
        group_width = total_width / n_groups

        for group_idx, group in enumerate(level):
            x_center = (group_idx + 0.5) * group_width
            y = y_positions[level_idx]

            # Create text for the group
            text = "[" + ", ".join(map(str, group)) + "]"

            # Color based on level
            color = colors[level_idx % len(colors)]

            fig.add_trace(go.Scatter(
                x=[x_center],
                y=[y],
                mode='markers+text',
                marker=dict(size=40, color=color, opacity=0.8),
                text=[text],
                textposition="middle center",
                textfont=dict(size=10, color='white'),
                hoverinfo='text',
                hovertext=f"{label}: {text}",
                showlegend=False
            ))

    # Add level labels
    for i, label in enumerate(labels):
        fig.add_annotation(
            x=-0.5, y=y_positions[i],
            text=label,
            showarrow=False,
            font=dict(size=12),
            xanchor='right'
        )

    fig.update_layout(
        title="Merge Sort: Divide and Conquer",
        xaxis=dict(showticklabels=False, showgrid=False, zeroline=False, range=[-2, 11]),
        yaxis=dict(showticklabels=False, showgrid=False, zeroline=False, range=[-0.5, 6.5]),
        template="plotly_white",
        height=500
    )

    return fig


def create_sort_comparison_figure():
    """Create sorting algorithm comparison figure."""
    np.random.seed(42)

    sizes = [100, 500, 1000, 2500, 5000, 7500, 10000]

    # Simulated timing data (relative, based on complexity)
    # In practice these would be measured, but we use theoretical models
    merge_times = [n * np.log2(n) / 1000 for n in sizes]
    quick_avg = [n * np.log2(n) / 900 for n in sizes]  # Slightly faster constant
    quick_worst = [n * n / 50000 for n in sizes]  # O(n²) worst case
    bubble_times = [n * n / 100000 for n in sizes]
    insertion_times = [n * n / 120000 for n in sizes]

    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=sizes, y=merge_times,
        mode='lines+markers',
        name='Merge Sort',
        line=dict(color='#2ecc71', width=3),
        marker=dict(size=8)
    ))

    fig.add_trace(go.Scatter(
        x=sizes, y=quick_avg,
        mode='lines+markers',
        name='Quick Sort (avg)',
        line=dict(color='#3498db', width=3),
        marker=dict(size=8)
    ))

    fig.add_trace(go.Scatter(
        x=sizes, y=quick_worst,
        mode='lines+markers',
        name='Quick Sort (worst)',
        line=dict(color='#3498db', width=2, dash='dash'),
        marker=dict(size=6)
    ))

    fig.add_trace(go.Scatter(
        x=sizes, y=insertion_times,
        mode='lines+markers',
        name='Insertion Sort',
        line=dict(color='#e74c3c', width=2),
        marker=dict(size=6)
    ))

    fig.add_trace(go.Scatter(
        x=sizes, y=bubble_times,
        mode='lines+markers',
        name='Bubble Sort',
        line=dict(color='#9b59b6', width=2),
        marker=dict(size=6)
    ))

    fig.update_layout(
        title="Sorting Algorithm Performance Comparison",
        xaxis=dict(title="Array Size (n)", type="log"),
        yaxis=dict(title="Relative Time (arbitrary units)", type="log"),
        template="plotly_white",
        legend=dict(x=0.02, y=0.98),
        hovermode='x unified'
    )

    return fig


if __name__ == "__main__":
    output_dir = "/Users/leo.torres/aris/studio/press-demos"

    print("Generating CLT dice figure...")
    fig = create_clt_dice_figure()
    fig.write_html(f"{output_dir}/clt-dice.html", include_plotlyjs='cdn')

    print("Generating merge sort visualization...")
    fig = create_merge_sort_figure()
    fig.write_html(f"{output_dir}/merge-sort-viz.html", include_plotlyjs='cdn')

    print("Generating sort comparison figure...")
    fig = create_sort_comparison_figure()
    fig.write_html(f"{output_dir}/sort-comparison.html", include_plotlyjs='cdn')

    print("Done! Files created:")
    print(f"  {output_dir}/clt-dice.html")
    print(f"  {output_dir}/merge-sort-viz.html")
    print(f"  {output_dir}/sort-comparison.html")
